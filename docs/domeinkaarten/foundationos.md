# Premiumdomeinkaart FoundationOS

*Beyond Premium, met de bijstelling en de aanscherping van de eigenaar van 19
oktober 2026. Geschreven op de werktak `appwerkt/foundation` door de
FoundationOS-agent op 19 oktober 2026.*

Dit is een kaart en geen bouwopdracht. Een functie wordt pas werk als de
eigenaar haar per familie toezegt.

## Hoe deze kaart werkt

**De besluiten waarbinnen alles staat.**
- Vóór V1 komen er geen nieuwe domeinen of apps. De bestaande apps worden
  verdiept.
- Premiumfuncties worden standaard waar dat technisch, juridisch en financieel
  haalbaar is.
- De architectuur blijft stabiel: geen nieuwe motoren, lagen of centrale
  database.
- Leven is een overkoepelende projectie en nooit eigenaar.
- In de producttaal heet het "app".
- Professionals werken alleen binnen de bestaande genres.
- Het werkwoord van FoundationOS blijft *openen en klaarzetten; bevestigen doet
  de mens* (`FOUNDATION.md` par. 2).
- Huisregels:
  - leren is geen wedstrijd;
  - progressie bestaat alleen voor 18+ (`progressieMag`);
  - de beschermingsdeur blijft open;
  - geen verzonnen data;
  - geen cijfer op een mens;
  - alleen geaggregeerd naar gemeenten.

**Vier onderzoeken per app.**
1. *Bestaande werkelijkheid*: wat gebouwd, getoetst en bewezen is (sectie a).
2. *Marktmaximum*: inclusief de duurste pakketten (sectie b).
3. *Domeinmaximum*: hoe de mensen in het domein echt werken, met de regels die
   gelden (sectie c).
4. *RTG Beyond*: wat ontstaat door apps, rollen en processen te verbinden
   (sectie e).

**Per app**:
- a–h volgens de opdracht;
- de functiecatalogus in L1–L6 (sectie d). Elke functie heeft gegevens en bron,
  regels en rekenwijze, onzekerheid, wie wat wanneer hoort, rollen en
  toestemming, uitzonderingen en een acceptatiecriterium;
- **Uitkomst A** (binnen de huidige architectuur en scope) en **Uitkomst B**
  (het domeinmaximum, ook buiten de scope, met nieuwe professionele processen);
- de ketens LOS en SAMEN met storingen;
- het eindcontract (h). Dat contract **komt bovenop de acht APPWERKT-bewijzen
  en vervangt ze nooit**;
- de behoeften die in een andere app thuishoren, met de eigenaar volgens
  `SCHERMEIGENAAR.json`.

**Over de bronnen, eerlijk.** In deze sessie kon geen enkele webpagina worden
geopend; de proxy liet alleen de zoekdienst door. Elke externe bron staat
daarom in de vorm `naam — URL (zoekresultaat 2026-10-19, pagina niet
geopend)`. Prijzen en functies staan er alleen als het zoekresultaat ze
noemde; anders staat er "geen gegevens". Wetsartikelen staan er alleen als een
zoekresultaat ze gaf. Vóór een toezegging moet iemand met open netwerk de
bronnen nalezen. Repo-feiten zijn gelezen in de code, met het bestand erbij.

## De stand van de bewijzen

Er zijn twee bronnen, en ze verschillen:

1. **Het centrale register** (`APPWERKT.json`, stempel 05:16, commit af81b538).
   Dat is gemeten vóór de voltooiscenario's van FoundationOS samenkwamen.
   Daarom staan voltooibaar, persistent en herstelbaar daar voor de meeste
   apps nog op "geen fixture".
2. **De voltooiproef van vandaag** op de werktak. Die sluit voor 13 van de 14
   rijen:

| app | APPWERKT (af81b538) | voltooiproef vandaag | BEVOEGD |
|---|---|---|---|
| Buurtruil | bereikbaar, bedienbaar, waarheid, bevoegd bewezen | 7/3/4/3 sluit | 1/1 |
| Geven | idem | 8/3/4/3 sluit (gratis account met gekeurd paspoort, echt geld via de simulatiebank) | 1/1 |
| Klimaatfonds | idem | 8/3/4/3 sluit | 1/1 |
| Library | idem | 8/3/4/3 sluit | 1/1 |
| Connect | bereikbaar, waarheid, bevoegd | 8/3/5/3 sluit | 5/5 |
| RTF Buurt | idem als Buurtruil | 7/3/3/3 sluit | 1/1 |
| RTF Portaal | idem | 8/3/3/3 sluit | 1/1 |
| RTF Bord | alleen bevoegd | 8/3/4/3 sluit | 4/5 |
| RTF Schrift | alleen bevoegd | 8/3/4/3 sluit | 4/5 |
| Vrienden | bereikbaar, bedienbaar, bevoegd | 7/3/5/3 sluit | 10/12 |
| Kwesties | alle acht bewezen | scenario van een andere agent | 1/1 |
| Zorg (tab) | niets bewezen (geen eigen adres) | 8/3/4/3 sluit (echt geld, pakket in twee regels) | niet getest |
| Foundation-zorg | idem als Buurtruil | 9/3/4/3 sluit (echt geld, reproduceerbare weigering) | 4/5 |
| RTF-tegel | niets bewezen (kiezer) | geen scenario | niet getest |

`IDOR.json` heeft voor de meeste FoundationOS-routes "onbereikbaar": de meter
had geen id van A, dus scheiding is daar niet door IDOR bewezen. Alleen Care
(11 gescheiden) en Kwesties (11 gescheiden) zijn door IDOR gemeten. De
kruisproeven in de voltooiscenario's dekken de rest per app. Het register moet
opnieuw worden gemeten (`npm run appwerkt:vers`); dat doet de integrator.

## Wat dit onderzoek al opleverde

Gerepareerd, failing-first, op de werktak:

| wat | sha | toets |
|---|---|---|
| op een gedeeld toestel gaat de gezinssessie van A niet mee naar B | af89167b | `test/gezinssessie-gedeeld-toestel.e2e.js` |
| de hulpwijzer gaat door de code-grens van `kern/zorgniveau.js`: crisis naar 113, huisarts en 112; medicatie en diagnose naar een behandelaar | b0094e9d | `test/hulpwijzer-grens.test.js` |
| de link van Hulp & Zorg naar de zorgtab landt op de zorgtab | b0094e9d | `test/foundation-applinks.test.js` |

Gemeten en geen lek: snaps en verhalen in Vrienden. Een beschermd kind (t/m 15)
is onvindbaar en onbenaderbaar. Alleen de ouder voegt contacten toe, en snaps
en verhalen gaan alleen tussen actieve vrienden. Dat blijkt uit de toetsen
`beschermd`, `snaps-routes` en `rtf-veilig` (17/17). De drie ontwerpvragen die
daaruit volgen, staan bij Vrienden (VRI-08, VRI-12, VRI-14).

Voorgelegd aan de integrator, met een besluit nodig:
- annuleren van een betaalde Care-afspraak betaalt niets terug;
- Kliniek Clara biedt huisarts- en fysiotherapiezorg aan onder het open genre
  'zorg';
- het gemeenteportaal geeft kleine getallen zonder drempel door (perSoort en
  tellingen per project);
- RTF Buurt mist de accountdeur;
- de kinder-boardroom wordt op `/api/rtf/social/*` waarschijnlijk niet
  afgedwongen (nog te meten).

Elk punt staat ook als functie in de catalogus van zijn app.

## Inhoud

1. Buurtruil · 2. Geven · 3. Klimaatfonds · 4. Library · 5. Connect · 6. RTF Buurt ·
7. RTF Portaal · 8. RTF Bord · 9. RTF Schrift · 10. Vrienden · 11. Kwesties /
Discussiekamer · 12. Zorg (tab) · 13. Foundation-zorg · 14. RTF-tegel

---

## 1. Buurtruil — `link:buurtruil`, `/apps/foundation/buurtruil.html`

De Buurtruil is de plek waar een bewoner met een eigen RTG-account spullen weggeeft of zoekt binnen zijn eigen RTF-stad, zonder geld en zonder prijs. De app is voor leden (SCHERMEIGENAAR.json: `gemeenschap.buurtruil`, rol eigenaar, doelgroep `lid`). De kern is een aanbod dat aan een codenaam hangt en nooit aan een naam. Belangstelling is een signaal dat de eigenaar zelf ophaalt en geen bericht dat vertrekt. Melden verbergt en oordeelt niet, en elke teller dedupliceert op codenaam (`server/kern/rtfos/ruil.js`, vijf grendels in de kop). Het is met opzet geen marktplaats: zodra er een prijsveld komt, gelden de btw-, retour- en consumentenregels die deze module niet draagt (kop van `ruil.js`).

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | 3 stappen gesloten (afgeleid) | het register is van vóór de scenario's |
| voltooibaar | GEEN_FIXTURE | 7 stappen gesloten | 4 handelingsstappen + 3 bevoegdheidsstappen (zonder account, vreemd lid, kind) |
| waarheidsgetrouw | BEWEZEN | — | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | herstart, read-only lezer, nieuwe sessie |
| bevoegd | BEWEZEN | — | BEVOEGD.json: 1/1 kruisparen gescheiden |
| herstelbaar | GEEN_FIXTURE | 4 stappen gesloten | dubbele tik plaatsen, dubbele tik belangstelling, afgebroken plaatsing, crash na plaatsing |
| IDOR | — | — | 6 routes "onbereikbaar": de meter had geen id van A, dus niet bewezen |

Bron van de voltooiproef: `scripts/lib/voltooi/buurtruil.js`. De proef zegt zelf wat ze níét dekt: "het verbergen na twee meldingen en de werkvoorraad van de stichting lopen hier niet mee", de stad opent via de kantoorroutes en er is geen Redis of PostgreSQL in de wereld.

Wat de code doet (gelezen):
- **Routes** (`server/routes/rtfos/ruil.js`): `POST /api/rtfos/ruil/lijst`, `/mijn`, `/plaats`, `/sluit`, `/interesse`, `/meld`. Alle zes vragen `auth` en `geenGast`. De codenaam komt uit de sessie (`liveCodename`) en niet uit het verzoek. Er zijn twee remmen op de sessie en niet op het IP: schrijven 20 per minuut, lezen 120 per minuut. Het is "de enige RTFOS-deur die op een ledensessie opengaat"; omdat een gezinsprofiel geen eigen account heeft, is dat meteen de leeftijdsgrens zonder dat er een geboortedatum gelezen wordt. Bewust níét `volwassen()` (A3), omdat dat "vrijwel iedereen buiten" zou sluiten.
- **Kern** (`server/kern/rtfos/ruil.js`): soorten `geef`/`zoek`, standen `open`, `weg`, `ingetrokken` en `verborgen`. Een aanbod kan alleen in een stad met status `actief`. Plaatsen heeft een herhaalsleutel (`idem`), titel 3–80 tekens, omschrijving tot 600 tekens, een vrij veld `staat` tot 40 tekens en een rem van 20 open aanbiedingen per lid. De lijst toont maximaal 200 rijen, nieuwste eerst. Alleen de eigenaar ziet de belangstellenden (codenamen, maximaal 50), een ander ziet alleen het aantal. Belangstelling kan alleen op een open aanbod, niet op je eigen aanbod, één keer per codenaam en tot maximaal 200 per aanbod. Melden kan niet op je eigen aanbod en één keer per lid; bij `MELDGRENS = 2` meldingen van verschillende leden gaat het aanbod naar `verborgen`, en de melder krijgt te horen wat er gebeurde. Wie meldde, ziet niemand.
- **Werkvoorraad van de stichting:** de functie `gemeld(stadId)` bestaat in de kern. **Geen route roept hem aan** (gezocht in `server/` en `public/`: geen treffer op `ruil.gemeld` of `ruil/gemeld`). Er is ook geen handeling waarmee een mens van de stichting een verborgen aanbod terugzet of definitief sluit. Grendel 3 belooft dat "iemand van de stichting ernaar kijkt", maar daar is vandaag geen deur voor.
- **Scherm** (`public/apps/foundation/buurtruil.html`): zonder token een inlogpoort naar `/apps/app.html`. Steden komen uit `/api/rtfos/publiek/steden`. Er zijn tabbladen (alles, geef, zoek, mijn) met de handelingen belangstelling, afgerond (`weg`), intrekken en melden met reden. De zin "Je naam staat er niet bij … Er wordt niets verstuurd en niemand krijgt jouw gegevens" staat op het scherm.
- **Toetsen:** `test/rtfos-ruil.test.js`, `test/rtfos-gift-ruil-routes.test.js`, `test/buurtruil-scherm.e2e.js` (bestaan; niet gedraaid in deze opdracht).

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Buy Nothing | gratis kern; Sustaining Membership (duurste) | gratis kern; Sustaining Membership $49,95 per jaar | Give/Ask/Gratitude, groepen per buurt, interesse-tracker; abonnement: posts "boosten", tot 5 locaties met eigen straal, privégemeenschappen, groepsberichten, bladwijzers, statussen "Simmer" en "Flash", straal 10 of 50 mijl, abonneebadge | Buy Nothing — https://buynothingproject.org/mobile-app (zoekresultaat 2026-10-19, pagina niet geopend); Buy Nothing Help — https://help.buynothingproject.org/article/41-what-are-the-benefits-of-a-buy-nothing-subscription (zoekresultaat 2026-10-19, pagina niet geopend); Buy Nothing gift — https://buynothingproject.org/gift (zoekresultaat 2026-10-19, pagina niet geopend) |
| Nextdoor (For Sale & Free / Free Finds) | gratis | gratis volgens het resultaat; geen betaald pakket gevonden | weggeven/verkopen in de buurt, Free Finds om gratis aanbod te bekijken zonder account (contact vraagt een gratis account), categorieën "Neighbor Made" en "Neighbor Services" | Nextdoor — https://nextdoor.com/for_sale_and_free/ (zoekresultaat 2026-10-19, pagina niet geopend); Nextdoor blog — https://blog.nextdoor.com/2021/06/03/introducing-free-finds-a-new-experience-to-find-free-items-nearby (zoekresultaat 2026-10-19, pagina niet geopend; bericht uit 2021) |
| Freecycle | gratis lidmaatschap | geen gegevens over een betaald pakket | lokale groepen met vrijwillige moderators (regionale moderators erboven), regels: gratis, legaal, geschikt voor alle leeftijden; soms goedkeuring door een moderator | Waste360 — https://www.waste360.com/waste-recycling/freecycle-network-fuels-gifting-economy (zoekresultaat 2026-10-19, pagina niet geopend; secundaire bron) |
| OLIO | geen gegevens over actuele pakketten | geen gegevens (het zoekresultaat noemde alleen een niet-actueel bedrag zonder herleidbare bron) | delen van voedsel en ook non-food huishoudspullen | OLIO — https://tech.olioex.com/about/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Hoplr (buurtplatform, gemeente betaalt) | gemeentecontract | geen gegevens (prijs per demo/offerte) | buurtnetwerk, communicatie tussen gemeente, partners en bewoners | Hoplr — https://services.hoplr.com/nl (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie bij de leiders | wij |
|---|---|
| geven en vragen (Give/Ask) | ja (`geef`/`zoek`) |
| groepen per buurt | half: per RTF-stad, niet per buurt of straat |
| interesse tonen en zien wie | ja (alleen de eigenaar ziet codenamen) |
| één ontvanger kiezen / toezeggen | nee |
| foto bij het aanbod | nee |
| zoeken en categorieën | nee (alleen het tabblad geef/zoek) |
| moderatie door mensen | half: verbergen na twee meldingen bestaat, maar de werkvoorraad heeft geen route |
| "Gratitude" / bedanken | nee, en zonder score hoort dat ook zo (zie BR-21) |
| boosten, Flash-status, grotere straal | nee, bewust (zie "niet doen") |
| bekijken zonder account | nee, bewust: gebruiken vraagt een account (huisregel) |

### c. Het volledige domein

**Particulier.** Mensen geven spullen weg via buurtgroepen, weggeefkasten, kringloopwinkels en platforms als Buy Nothing en Freecycle. Het gaat bijna altijd om drie handelingen: aanbieden, iemand kiezen en een ophaalmoment afspreken. Veruit de meeste frictie zit in het kiezen ("wie was eerst?") en in mensen die niet komen opdagen. Bij kinderspullen (autostoeltjes, babybedjes, kinderstoelen) speelt veiligheid. De zoekresultaten noemen voor tweedehands autostoeltjes de keurlabels ECE R44/03, R44/04 en R129, en dat zitjes met R44/01 of R44/02 niet meer verkocht of gebruikt mogen worden. Een zitje dat ooit bij een ongeluk betrokken was, geldt als onveilig, ook als de schade niet zichtbaar is. Ook heeft een zitje een beperkte levensduur (ANWB — https://www.anwb.nl/auto/autostoeltjes/tweedehands-autostoeltje-kopen (zoekresultaat 2026-10-19, pagina niet geopend); Radar — https://radar.avrotros.nl/artikel/tweedehands-autostoeltje-kopen-hier-moet-je-op-letten-54094 (zoekresultaat 2026-10-19, pagina niet geopend)). Volgens een zoekresultaat voldeden bij een NVWA-onderzoek 10 van de 24 kinderstoeltjes niet aan de veiligheidseisen (Radar — https://radar.avrotros.nl/artikel/nvwa-10-van-de-24-kinderstoeltjes-voldoen-niet-aan-veiligheidseisen-17660 (zoekresultaat 2026-10-19, pagina niet geopend)), en bij kinderbedjes volgden een terugroepactie en boetes (Kassa — https://www.bnnvara.nl/kassa/artikelen/nvwa-veiligheidsrisicos-bij-40-procent-onderzochte-kinderbedjes (zoekresultaat 2026-10-19, pagina niet geopend)).

**Professioneel.** Er werken kringloopwinkels, weggeefwinkels, Repair Cafés (volgens een NOS-bericht uit 2026 zijn er bijna 700 in Nederland: https://nos.nl/l/2541164 (zoekresultaat 2026-10-19, pagina niet geopend)), voedselbanken en klusdiensten. In het genre-register van dit huis (`server/seed/genres-lijst-a.js`/`-b.js`) bestaan `vakwerk` (Vakwerk & klussen), `verhuizer` (Verhuisservice), `groothandel` en `retail`, maar geen eigen genre voor kringloop of reparatie. Geen van die genres staat onder de acht met een vergunningseis (`EISEN_IDS` in `server/kern/aanmeldingen/bewijs.js`: ziekenhuis, huisarts, specialist, apotheek, beautymedical, kinderopvang, verzekeringen, beveiliging). RTG controleert van een reparateur dus niets inhoudelijk, en mag dat ook niet suggereren.

**Organisatorisch.** Een weggeefgroep draait op vrijwillige moderatoren (Freecycle: lokale en regionale moderators). Gemeenten financieren buurtplatforms en laten bewoners het platform gratis gebruiken (Hoplr). De stichting draagt hier de moderatie (grendel 3) en heeft een eigen voorraad met uitgifte naar een project of een hulpvraag-codenaam, nooit naar een persoon (`server/kern/rtfos/voorraad-uitgifte.js`).

**Regels.**
- **AVG/UAVG.** Een aanbod met een foto of een vrije omschrijving kan persoonsgegevens dragen (adres, gezicht, kenteken). Opslagbeperking en het recht op inzage en wissen gelden. Het zoekresultaat over verwerkersovereenkomsten noemt art. 28 lid 3 AVG voor uitbesteding (Dialog — https://www.dialog.nl/wp-content/uploads/2024/02/verwerkersovereenkomst.pdf (zoekresultaat 2026-10-19, pagina niet geopend)). Voor deze app is dat pas van belang als er een externe verwerker bij komt (bijvoorbeeld beeldopslag).
- **Productveiligheid.** De verantwoordelijkheid voor een weggegeven product ligt bij de gever. RTG keurt niets, maar kan bij bekende risicocategorieën de vaste vragen tonen (BR-13).
- **Geen handel.** Zodra er geld of een tegenprestatie bij komt, is het geen ruil meer (kop van `ruil.js`; zie GIFT.md par. 9: een aankoop is geen gift).

**Wat daaruit volgt voor de app.** De ontbrekende helft zit niet in het plaatsen maar in het **toezeggen en overdragen** (BR-06, BR-17), in de **menselijke moderatie** die vandaag geen deur heeft (BR-10), en in **veiligheid bij kinderspullen** zonder schijnkeuring (BR-13). Een prijs, een boost, een reputatiescore of een landelijke straal komen er niet: dat maakt van een buurtruil een marktplaats of een aandachtsmachine.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** de kern staat (plaatsen, belangstelling, sluiten, melden); wat ontbreekt is kiezen en afspreken, en zoeken.
- **L2 Professioneel via bestaande genres:** dun en terecht dun. Er is geen gecontroleerd genre voor kringloop of reparatie, dus hooguit een verwijzing naar `vakwerk` zonder kwaliteitsbelofte.
- **L3 Organisatorisch:** de moderatie van de stichting bestaat in de kern maar heeft geen route en geen scherm. Dat is het grootste gat.
- **L4 Domeinintelligentie:** vaste regels voor risicocategorieën en suggesties voor vraag en aanbod, nooit als feit en nooit als automatisch bericht.
- **L5 Volledige levenscyclus:** van plaatsen tot overgedragen of verlopen, met bewaartermijn en eigen inzage; vandaag zijn het vier standen zonder einde in de tijd.
- **L6 RTG-samenhang:** ophaalmoment in Agenda, afspraak via Berichten, doorgeven aan de stichting; alles via verwijzing en niets via gedeelde data.

**BR-01 Aanbod plaatsen (geef of zoek)** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `S().ruil`-rij (`id`, `stad`, `codenaam`, `soort`, `titel`, `wat`, `staat`, `status`, `interesse[]`, `meldingen[]`, `idem`, `at`), opgeslagen in het rtfos-domein.
- Regels en rekenwijze: alleen een actieve stad; titel ≥ 3 tekens; maximaal 20 open per lid; herhaalsleutel; dezelfde sleutel met een andere titel geeft 409.
- Onzekerheid: het veld `staat` is vrije tekst ("goed") en wordt nergens gekeurd.
- Wie hoort wat, wanneer: niemand krijgt bericht; het aanbod verschijnt in de lijst van de stad.
- Rollen en toestemming: een eigen account (sessie); een gezinsprofiel komt er niet in.
- Uitzonderingen: een stad die niet actief is, geeft 409 met de zin dat de afdeling nog niet open is.
- Acceptatiecriterium: Gegeven een lid met een eigen account in een actieve stad, wanneer hij twee keer met dezelfde herhaalsleutel plaatst, dan staat het aanbod er één keer, onder zijn codenaam en zonder naam of e-mailadres in de opslag (voltooiproef: gesloten).

**BR-02 Belangstelling tonen; de eigenaar ziet wie** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `interesse[]` met codenamen in de rij.
- Regels en rekenwijze: één keer per codenaam; niet op je eigen aanbod; alleen op een open aanbod; maximaal 200; alleen de eigenaar ziet de lijst (maximaal 50).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand krijgt een bericht. De eigenaar ziet het aantal en de codenamen als hij Mijn aanbod opent.
- Rollen en toestemming: een eigen account.
- Uitzonderingen: een gesloten aanbod geeft 409.
- Acceptatiecriterium: Gegeven een open aanbod van A, wanneer buur B twee keer op belangstelling tikt, dan telt het één keer, ziet A de codenaam van B en ziet B de lijst van belangstellenden niet (voltooiproef: gesloten).

**BR-03 Sluiten, intrekken en Mijn aanbod** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `status`, `dichtAt`.
- Regels en rekenwijze: alleen de eigenaar; de doelstand is `weg` of `ingetrokken`; `open` en `verborgen` kunnen niet met deze handeling.
- Onzekerheid: `weg` zegt niet aan wie het ging. Dat is bewust (geen tweede persoon in de data).
- Wie hoort wat, wanneer: de belangstellenden horen niets, ze zien het aanbod alleen uit de lijst verdwijnen (zie BR-06).
- Rollen en toestemming: de eigenaar (403 voor anderen).
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een aanbod van A, wanneer B het probeert in te trekken, dan krijgt B 403 en blijft de stand `open` (voltooiproef: gesloten).

**BR-04 Melden; twee meldingen verbergen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `meldingen[]` (`door`, `reden` tot 200 tekens, `at`).
- Regels en rekenwijze: `MELDGRENS = 2` van verschillende leden zet `open` op `verborgen`; één melding verbergt niets en dat wordt gezegd.
- Onzekerheid: de grens is een ontwerpkeuze, geen meting.
- Wie hoort wat, wanneer: de melder krijgt de uitkomst. De eigenaar hoort vandaag niets (zie BR-10). Wie meldde, blijft verborgen voor iedereen behalve de werkvoorraad, die alleen reden en tijd toont.
- Rollen en toestemming: een eigen account; niet op je eigen aanbod.
- Uitzonderingen: niet getest in de voltooiproef ("het verbergen na twee meldingen … loopt hier niet mee").
- Acceptatiecriterium: Gegeven een open aanbod, wanneer twee verschillende leden het melden, dan staat het niet meer in de lijst en blijft de rij met beide redenen bestaan.

**BR-05 Foto bij een aanbod** · L1 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: een beeld dat aan de aanbod-id hangt. Opslag via de uploadlaag van het huis: twijfel, ik heb niet nagekeken welke uploadvoorziening er is (aan de integrator voorleggen).
- Regels en rekenwijze: metadata (locatie, toestel) eruit vóór opslag; één tot drie beelden; het beeld verdwijnt met het aanbod volgens de bewaartermijn (BR-17).
- Onzekerheid: gezichten, kentekens of huisnummers op de foto; RTG beoordeelt het beeld niet.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: alleen de eigenaar plaatst en verwijdert.
- Uitzonderingen: zonder foto blijft het aanbod volledig bruikbaar.
- Acceptatiecriterium: Gegeven een foto met locatiegegevens in de bestandskop, wanneer het lid hem plaatst, dan bevat het opgeslagen beeld geen locatie en verdwijnt het zodra het aanbod wordt gewist.

**BR-06 Toezeggen aan één belangstellende en een ophaalafspraak klaarzetten** · L1 · half (belangstelling bestaat, toezeggen niet) · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: een nieuw veld `toegezegdAan` (codenaam van een belangstellende) en de stand `toegezegd` naast `open`; de afspraak zelf als verwijzing naar een gesprek in Berichten (`apps/comm.html`, `comm.berichten`), niet als kopie.
- Regels en rekenwijze: toezeggen kan alleen aan iemand uit `interesse[]`; één toezegging tegelijk; terugnemen kan, en dan is het aanbod weer `open`. Het werkwoord van FoundationOS: de app zet het gesprek klaar, de eigenaar bevestigt het versturen. Dat is één menselijke bevestiging, omdat het een tweede mens bereikt.
- Onzekerheid: of de ontvanger komt opdagen, weet niemand; daar komt geen score op.
- Wie hoort wat, wanneer: alleen de gekozen belangstellende krijgt het bericht dat de eigenaar verstuurde; de anderen zien "toegezegd" in de lijst, zonder naam.
- Rollen en toestemming: de eigenaar kiest; de ontvanger kan weigeren.
- Uitzonderingen: geen Berichten beschikbaar? Dan toont het scherm de codenaam en zegt het dat contact buiten de app gaat (zoals nu).
- Acceptatiecriterium: Gegeven een aanbod met drie belangstellenden, wanneer de eigenaar er één kiest en het klaargezette bericht bevestigt, dan krijgt alleen die ene het bericht, staat het aanbod op `toegezegd` en zien de twee anderen geen codenaam van de gekozene.

**BR-07 Zoeken en vaste categorieën** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: een gesloten lijst categorieën in de kern (zoals `SOORTEN`) en zoeken op titel binnen de stad.
- Regels en rekenwijze: de categorie is een beeld en geen grens, met hetzelfde principe als het projectfilter in `gift-projecten.js` grendel 2.
- Onzekerheid: een verkeerd gekozen categorie; geen gevolg behalve vindbaarheid.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: elk lid met een account.
- Uitzonderingen: zonder categorie valt het aanbod onder "overig".
- Acceptatiecriterium: Gegeven twintig aanbiedingen in Zwolle, wanneer een lid filtert op "kinderspullen", dan ziet hij alleen die categorie, en zonder filter ziet hij alles.

**BR-08 Verlopen zonder druk: "staat het er nog?"** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `at` bestaat al; nieuw is `verlooptAt` en de stand `verlopen`.
- Regels en rekenwijze: na een termijn (eigenaarsbesluit; een voorstel is 30 dagen, maar dat is geen gemeten waarde) valt het aanbod uit de lijst. Bij Mijn aanbod staat één knop "staat er nog". Geen push, geen aftellen, geen "nog 2 dagen!".
- Onzekerheid: de termijn is een keuze.
- Wie hoort wat, wanneer: de eigenaar ziet het bij zijn volgende bezoek; er gaat geen bericht uit.
- Rollen en toestemming: de eigenaar verlengt.
- Uitzonderingen: een `toegezegd` aanbod verloopt niet zolang de toezegging loopt.
- Acceptatiecriterium: Gegeven een aanbod ouder dan de termijn, wanneer een buur de lijst opent, dan staat het er niet in, en de eigenaar ziet het onder Mijn aanbod met de vraag of het er nog staat.

**BR-09 Doorverwijzen naar een reparatie-activiteit in de stad** · L2 · half (activiteiten bestaan in `server/kern/rtfos/activiteiten.js`, de verwijzing niet) · kosten klein · complexiteit laag · later
- Gegevens en bron: open activiteiten van de stad, langs dezelfde publieke lezer als `publiek.js` (naam, datum, plek, of er plek is).
- Regels en rekenwijze: alleen een verwijzing ("Kapot? Er is op [datum] een reparatieavond"); een `zoek` of `geef` met een vrij woord "kapot" toont hem, zonder model.
- Onzekerheid: of de reparateur het kan; RTG keurt geen vakmanschap (geen persoonseis voor `vakwerk`).
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: elk lid.
- Uitzonderingen: geen activiteit? Dan geen verwijzing en geen lege plek.
- Acceptatiecriterium: Gegeven een open reparatieactiviteit in Zwolle, wanneer een lid een kapotte lamp weggeeft, dan ziet hij één verwijzing naar die activiteit en wordt er niets aangemeld zonder zijn bevestiging.

**BR-10 Werkvoorraad voor de stichting: gemelde aanbiedingen beoordelen** · L3 · half (kern `gemeld()` bestaat, route en handelingen ontbreken) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `ruil.gemeld(stadId)` (bestaat) plus twee nieuwe handelingen: `herstel` (verborgen → open, met reden) en `sluitDoorStichting` (verborgen → gesloten, met reden uit een gesloten lijst).
- Regels en rekenwijze: de route hoort achter `officeAuth` van de stad, net als de andere RTFOS-kantoorroutes. Elk oordeel vraagt een reden en gaat in de audit. Een oordeel verwijdert de rij nooit.
- Onzekerheid: het oordeel is mensenwerk; er komt geen automatische classificatie.
- Wie hoort wat, wanneer: de eigenaar van het aanbod ziet de uitkomst en de reden onder Mijn aanbod. De melders horen dat er is gekeken, niet wat de uitkomst voor de ander was.
- Rollen en toestemming: een medewerker van de RTF-stad (kantoor).
- Uitzonderingen: een aanbod in een stad die inmiddels gesloten is, blijft beoordeelbaar.
- Acceptatiecriterium: Gegeven een aanbod dat na twee meldingen verborgen is, wanneer een kantoormedewerker van die stad het met reden herstelt, dan staat het weer in de lijst, ziet de eigenaar de reden en blijven de meldingen bewaard. Een lid zonder kantoortoken krijgt op deze route 401 of 403.

**BR-11 Een "zoek" beantwoorden uit de voorraad van de stichting** · L3 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: een verwijzing van de ruil-id naar een uitgifte in `voorraad-uitgifte.js`; de uitgifte wijst naar een project of een hulpvraag-codenaam, nooit naar een persoon (grendel 3 daar).
- Regels en rekenwijze: alleen een medewerker zet dit klaar; de voorraad zelf blijft niet-publiek (kop van `ruil.js`: "de voorraad van de stichting is geen publieke informatie"). Dat vraagt een eigenaarsbesluit.
- Onzekerheid: of een lid in de doelgroep valt, beoordeelt een mens.
- Wie hoort wat, wanneer: het lid ziet "de stichting heeft iets voor je klaargezet".
- Rollen en toestemming: kantoor; het lid bevestigt het ophalen.
- Uitzonderingen: voorraad over de datum gaat niet de deur uit (grendel 1 van `voorraad-uitgifte.js`).
- Acceptatiecriterium: Gegeven een `zoek` naar een kinderjas en een passende batch in de voorraad, wanneer een medewerker een uitgifte klaarzet, dan ontstaat er een uitgifte zonder persoonsnaam in het magazijnregister en ziet alleen de zoeker het klaargezette aanbod.

**BR-12 Buurtruil per stad aan of uit** · L3 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: een modulevlag per stad, net als de modules in `projecten.js` (`SOORTEN` → module).
- Regels en rekenwijze: staat de module uit, dan geeft de lijst een eerlijke 409 met reden.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de leden van die stad zien de reden.
- Rollen en toestemming: het landelijke bestuur of het stadsbestuur.
- Uitzonderingen: lopende aanbiedingen blijven leesbaar voor hun eigenaar.
- Acceptatiecriterium: Gegeven een actieve stad met de buurtruil uit, wanneer een lid de lijst opent, dan krijgt hij de reden en geen lege lijst.

**BR-13 Veiligheidsvragen bij risicocategorieën (kinderzitje, babybed, kinderstoel, fietshelm)** · L4 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: een vaste lijst met vragen per categorie in de kern (geen model). Voor autostoeltjes zijn dat het keurlabel (R44/03, R44/04 of R129, volgens het zoekresultaat van ANWB), "nooit bij een ongeluk betrokken" en de productiedatum.
- Regels en rekenwijze: de gever beantwoordt de vragen; de antwoorden staan bij het aanbod als "volgens de gever". Een gever die "weet ik niet" kiest, mag toch plaatsen, maar dat staat er dan zichtbaar bij.
- Onzekerheid: RTG keurt niets. Op het scherm staat de zin: "Dit is wat de gever zegt; RTG heeft het niet gecontroleerd." Een antwoord van de gever is geen feit.
- Wie hoort wat, wanneer: de belangstellende ziet de antwoorden vóór hij belangstelling toont.
- Rollen en toestemming: de gever.
- Uitzonderingen: als een label volgens het zoekresultaat niet meer gebruikt mag worden (R44/01, R44/02), weigert de app met die reden. Of dat juridisch klopt, laat ik aan een mens: dit is een eigenaarsbesluit met een juridische toets.
- Acceptatiecriterium: Gegeven een gever die een autostoeltje plaatst, wanneer hij "R44/02" kiest, dan wordt het niet geplaatst en staat de reden erbij. Kiest hij "weet ik niet", dan staat dat zichtbaar bij het aanbod met de zin dat RTG niets heeft gecontroleerd.

**BR-14 Terugroepcheck tegen een openbare lijst** · L4 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: een openbare terugroeplijst (NVWA of fabrikant). Geen gegevens over een bruikbare koppeling: ik heb geen bron gevonden die een API noemt.
- Regels en rekenwijze: alleen een verwijzing ("Kijk of dit model is teruggeroepen"), tot er een betrouwbare bron is.
- Onzekerheid: "niet op de lijst" is geen "veilig".
- Wie hoort wat, wanneer: de gever en de belangstellende.
- Rollen en toestemming: geen.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een aanbod in een risicocategorie, wanneer de terugroepcheck geen bron heeft, dan zegt het scherm dat er niet is gecontroleerd en suggereert het nergens dat het model veilig is.

**BR-15 Vraag en aanbod naast elkaar zetten (suggestie voor de eigenaar)** · L4 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de eigen `zoek`-rijen en de `geef`-rijen in dezelfde stad en categorie.
- Regels en rekenwijze: alleen tonen aan de eigenaar van de `zoek` ("er is een kinderfiets aangeboden"), bij het openen van Mijn aanbod. Geen bericht, geen push. De match is een voorspelling en geen feit.
- Onzekerheid: categorie-overlap is geen echte match.
- Wie hoort wat, wanneer: alleen de zoeker, en pas als hij zelf kijkt.
- Rollen en toestemming: de eigenaar van de zoek.
- Uitzonderingen: verborgen of gesloten aanbod wordt nooit gesuggereerd.
- Acceptatiecriterium: Gegeven een `zoek` naar een kinderfiets en een open `geef` van een kinderfiets in dezelfde stad, wanneer de zoeker Mijn aanbod opent, dan ziet hij één suggestie, en de gever krijgt niets te zien of te horen.

**BR-16 Hergebruik geaggregeerd voor stad en gemeente** · L4 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: telling van `weg` per stad per kwartaal.
- Regels en rekenwijze: alleen geaggregeerd en met een k-drempel, langs `gemeente.js` (LEVEN 2.6). Onder de drempel staat er "niet gemeten" en geen nul.
- Onzekerheid: `weg` betekent "de eigenaar zegt dat het weg is", niet "hergebruikt".
- Wie hoort wat, wanneer: het stadsbestuur en de gemeente via het portaal.
- Rollen en toestemming: kantoor en gemeente (`portaal.toegang`).
- Uitzonderingen: geen getal per buurt of straat.
- Acceptatiecriterium: Gegeven een kwartaal met minder aanbiedingen dan de k-drempel, wanneer de gemeente het beeld opvraagt, dan ziet zij "niet gemeten" en geen getal.

**BR-17 Volledige levenscyclus met bewaartermijn** · L5 · half · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: de standen `open`, `toegezegd` (BR-06), `weg`, `ingetrokken`, `verlopen` (BR-08), `verborgen`, `hersteld`/`gesloten` (BR-10).
- Regels en rekenwijze: een gesloten aanbod wordt na een bewaartermijn (eigenaarsbesluit) ontdaan van titel, omschrijving en foto. De audit blijft. Er is één plek waar de termijn staat.
- Onzekerheid: de juiste termijn vraagt een AVG-afweging; dat is mensenwerk.
- Wie hoort wat, wanneer: de eigenaar ziet in Mijn aanbod wanneer een gesloten aanbod wordt opgeschoond.
- Rollen en toestemming: systeemregel; de eigenaar mag eerder wissen.
- Uitzonderingen: een aanbod in een lopende beoordeling (BR-10) wordt niet opgeschoond.
- Acceptatiecriterium: Gegeven een aanbod dat langer dan de bewaartermijn gesloten is, wanneer de opruimregel draait, dan zijn titel en omschrijving leeg, staat de auditregel er nog en ziet de eigenaar "opgeschoond op [datum]".

**BR-18 Eigen gegevens inzien en wissen** · L5 · ontbreekt (in deze app) · kosten klein · complexiteit laag · later
- Gegevens en bron: de eigen ruil-rijen. De inzage loopt via "Wat weet RTG van mij" (`link:gegevens`, `/apps/mijn-gegevens.html`) als projectie, zonder kopie.
- Regels en rekenwijze: wissen van een eigen aanbod verwijdert de inhoud. Een melding die de eigenaar zelf deed, blijft anoniem bij het aanbod van een ander.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen het lid.
- Rollen en toestemming: het lid zelf.
- Uitzonderingen: een aanbod in beoordeling (BR-10) wordt gewist na de beoordeling.
- Acceptatiecriterium: Gegeven een lid met vijf aanbiedingen, wanneer hij "wat weet RTG van mij" opent, dan staan ze daar met een verwijzing naar de Buurtruil, en na wissen zijn titel en omschrijving weg.

**BR-19 Doorgeven aan de stichting (goederengift)** · L6 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de bronsoort `goederen` bestaat (GIFT.md par. 1, `geld-bron.js` kent de soorten). De ruil verwijst naar een bron, maar is er zelf geen.
- Regels en rekenwijze: een goederengift krijgt geen giftbewijs zolang de waarde niet vaststaat (`donateur.js: bewijsbaar()` weigert bij goederen). De stichting bevestigt de ontvangst.
- Onzekerheid: waarde en bruikbaarheid; daar oordeelt een mens.
- Wie hoort wat, wanneer: de gever ziet "ontvangen door de stichting" na de bevestiging door het kantoor.
- Rollen en toestemming: gever en kantoor.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een lid dat een kinderwagen aan de stichting geeft, wanneer het kantoor de ontvangst bevestigt, dan ontstaat er een bron van soort `goederen` zonder giftbewijs, en het ruilaanbod staat op `weg`.

**BR-20 Ophaalmoment in de Agenda zetten** · L6 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: een afspraak in `apps/agenda.html` (`agenda.afspraken`) met een verwijzing naar de ruil-id.
- Regels en rekenwijze: klaarzetten in de Agenda van het lid zelf; zonder bevestiging gaat er niets naar de ander.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen het lid zelf.
- Rollen en toestemming: het lid.
- Uitzonderingen: met de Agenda uit blijft de toezegging (BR-06) gewoon werken.
- Acceptatiecriterium: Gegeven een toegezegd aanbod, wanneer het lid "zet in mijn agenda" bevestigt, dan staat er één afspraak met een link terug naar het aanbod, en de agenda van de ander is onaangeroerd.

**BR-21 Bedanken zonder score** · L1 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: een korte bedankzin van de ontvanger aan de gever, als bericht via Berichten.
- Regels en rekenwijze: geen teller, geen sterren, geen "aantal bedankjes" op een profiel (geen score op een mens, LIFE.md par. 4 volgens de kop van `ruil.js`).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de gever.
- Rollen en toestemming: de ontvanger verstuurt, met één bevestiging.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een overgedragen aanbod, wanneer de ontvanger bedankt, dan krijgt de gever één bericht en verandert er niets aan een profiel of teller.

**BR-N1 Prijs of verkoop** · niet doen — dan is het een marktplaats met btw-, retour- en consumentenregels die deze module niet draagt (kop `ruil.js`), en de Mall of de winkel zijn de plekken voor een aankoop.

**BR-N2 Boost, "Flash"-status of grotere straal tegen betaling** · niet doen — kunstmatige urgentie en betaalde zichtbaarheid zijn verslavende patronen, en een grotere straal maakt van de buurt een landelijke markt (grendel 4).

**BR-N3 Reputatie, waardering of no-show-teller op een lid** · niet doen — een score op een mens is in dit huis verboden.

**BR-N4 Bezorgen van spullen via vervoer of koeriers** · niet doen (nieuw domein vóór V1) — bezorgen is "een andere laag" (kop `ruil.js`) en vraagt een gegevenspoort en een vervoerketen die er niet is.

**BR-N5 Bekijken zonder account** · niet doen — gebruiken vraagt minimaal een gratis account, en de Buurtruil staat bewust niet in de lijst met uitzonderingen.

### e. RTG-exclusief

1. **Toezeggen zonder adressenlijst.** De keten is Buurtruil (aanbod en toezegging, eigenaar Buurtruil) → Berichten (gesprek, eigenaar `comm.berichten`) → Agenda (ophaalmoment, eigenaar `agenda.afspraken`). Alleen de codenaam reist mee, de echte naam blijft in de kluis (`accounts.js`). Bij Buy Nothing of Nextdoor kent de ontvanger een profielnaam; hier kent hij een codenaam tot de gever zelf iets prijsgeeft.
2. **Van zoekvraag naar stichtingsvoorraad.** Buurtruil (`zoek`, eigenaar Buurtruil) → RTF-kantoor (oordeel, eigenaar `kantoor.rtfbeheer`) → voorraaduitgifte (`voorraad-uitgifte.js`, bestemming project of hulpvraag-codenaam). De voorraad blijft niet-publiek; het lid ziet alleen wat voor hem is klaargezet. Geen platform in de vergelijking heeft een stichting met voorraad achter de buurtgroep.
3. **Kapot? Repareren in de eigen stad.** Buurtruil → RTF-activiteiten (reparatieavond, eigenaar het RTF-kantoor van de stad) → Agenda. Alleen een verwijzing.
4. **Hergebruik als geaggregeerd signaal voor de gemeente.** Buurtruil (telling) → `gemeente.js` met k-drempel → organisatieportaal (`apps/foundation/os-portaal.html`, `portaal.toegang`). Nooit per buurt of straat.

### f. Bouwstenen en ontbrekende koppelingen

Wat er staat: `server/kern/rtfos/ruil.js`, `server/routes/rtfos/ruil.js`, `public/apps/foundation/buurtruil.html`, `scripts/lib/voltooi/buurtruil.js`, `server/kern/rtfos/voorraad-uitgifte.js`, `server/kern/rtfos/activiteiten.js`, `server/kern/rtfos/publiek.js` (steden).

| koppeling | van → naar | vorm | stand |
|---|---|---|---|
| werkvoorraad gemeld | Buurtruil-kern → RTF-kantoor (`apps/foundation/kantoor.html`) | route + scherm op `gemeld()` | ontbreekt (kern bestaat) |
| gesprek bij toezegging | Buurtruil → Berichten (`apps/comm.html`) | verwijzing (ruil-id in het gesprek) | ontbreekt |
| ophaalmoment | Buurtruil → Agenda (`apps/agenda.html`) | verwijzing (ruil-id in de afspraak) | ontbreekt |
| reparatie | Buurtruil → RTF-activiteiten | projectie (publieke lezer) | ontbreekt |
| eigen gegevens | Buurtruil → `link:gegevens` | projectie | twijfel: aan de integrator voorleggen of de projectie al bestaat |
| leven/samenhang | Buurtruil → levensgraaf (`server/kern/levensgraaf/graaf.js`) | projectie (open aanbod als knoop) | niet nagekeken of de graaf de ruil al kent |
| goederengift | Buurtruil → bron `goederen` | verwijzing | ontbreekt; eigenaarsbesluit |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| BR-10 werkvoorraad stichting | nu | klein | laag | kantoorroute (`officeAuth`); geen besluit nodig, de belofte staat al in grendel 3 |
| BR-06 toezeggen + klaargezet bericht | nu | middel | midden | Berichten (`comm.berichten`) |
| BR-13 veiligheidsvragen | nu | klein | laag | BR-07 (categorie); juridische toets op de weigerzin |
| BR-07 zoeken en categorieën | nu | klein | laag | — |
| BR-08 verlopen zonder druk | nu | klein | laag | eigenaarsbesluit over de termijn |
| BR-17 levenscyclus + bewaartermijn | nu | klein | midden | BR-06, BR-08, BR-10; eigenaarsbesluit over de termijn |
| BR-05 foto | later | middel | midden | uploadlaag (twijfel), BR-17 |
| BR-09 reparatieverwijzing | later | klein | laag | activiteiten per stad |
| BR-11 voorraad op zoekvraag | later | middel | midden | eigenaarsbesluit (voorraad niet publiek) |
| BR-12 module per stad | later | klein | laag | — |
| BR-14 terugroepcheck | later | middel | hoog | externe bron (geen gegevens) |
| BR-15 vraag/aanbod-suggestie | later | middel | midden | BR-07 |
| BR-16 geaggregeerd voor gemeente | later | klein | laag | `gemeente.js` k-drempel |
| BR-18 eigen gegevens | later | klein | laag | `link:gegevens` |
| BR-19 goederengift | later | middel | midden | eigenaarsbesluit; `donateur.js` |
| BR-20 agenda | later | klein | laag | BR-06 |
| BR-21 bedanken zonder score | later | klein | laag | BR-06, Berichten |
| BR-N1 t/m N5 | niet doen | — | — | — |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **BR-10 + BR-06 + BR-07 + BR-08 + BR-13 + BR-17**, met de verwijzingen BR-20 en BR-21 als die goedkoop meekomen. Er komt geen motor of laag bij: het zijn handelingen in `ruil.js`, één kantoorroute en verwijzingen naar Berichten en Agenda.

Wat de gebruiker daarna kan wat hij nu niet kan:
- De **gever** kiest één belangstellende, zet met één bevestiging een bericht klaar en ziet zijn aanbod op `toegezegd` staan. Hij hoeft niet buiten de app te gaan zoeken hoe hij die codenaam bereikt.
- De **zoeker** vindt op categorie en titel, en ziet bij een autostoeltje wat de gever zegt over label, ongeluk en datum, met de eerlijke zin dat RTG niets heeft gecontroleerd.
- De **stichting** heeft eindelijk de deur die grendel 3 belooft: gemelde aanbiedingen beoordelen, met reden herstellen of sluiten.
- **Iedereen** heeft een lijst die niet volloopt met oude aanbiedingen, zonder push of aftellen, en de inhoud van gesloten aanbiedingen wordt na een termijn opgeschoond.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **circulair buurtnetwerk van de RTFoundation**: geven, lenen, repareren en herverdelen in één stad. Professionele en vrijwillige rollen dragen het, en het blijft zonder prijs en zonder score.

Nieuwe professionele processen die RTG hier kan ondersteunen:

1. **Moderator van een buurtruil (vrijwilliger van de stichting).**
   - Rol: vrijwilliger met de code van `os-vrijwilliger.html` (`werk.vrijwilligerswerk`).
   - Proces: aanmelden → VOG (het vrijwilligersportaal kent VOG-geldigheid) → instructie → werkvoorraad van de eigen stad (BR-10) → oordeel met reden → overdracht naar een betaalde medewerker bij twijfel.
   - Nodig: **eigenaarsbesluit** dat een vrijwilliger mag oordelen (vandaag alleen kantoor), en een tweede rechtenlaag mag er niet komen. Het moet dus een bestaande kantoorrol per stad zijn.
2. **Repair-coördinator (genre `vakwerk`).**
   - Proces: een reparatieavond plannen (RTF-activiteiten) → aanmeldingen van spullen uit de Buurtruil (verwijzing) → reparatie → terug in de ruil als `geef`.
   - Rol: een zaak of zzp'er in het genre `vakwerk`. Dat genre heeft geen persoonseis, dus RTG belooft geen vakmanschap.
   - Nodig: aansprakelijkheidsafspraken voor reparaties (extern, juridisch; het zoekresultaat gaf daar geen gegevens over) en een **eigenaarsbesluit** over wie aansprakelijk is.
3. **Kringloop of weggeefwinkel als partner (organisatie, L3).**
   - Proces: de partner registreert zich via het organisatieportaal (`os-portaal.html`, `portaal.toegang`) → ontvangt overschot uit de Buurtruil dat drie keer verliep (alleen met toestemming van de gever) → bevestigt de ontvangst.
   - Nodig: een partnerovereenkomst (extern), een **eigenaarsbesluit** over het doorgeven van verlopen aanbod, en de AVG-afweging: de partner ziet nooit de codenaam van de gever, alleen het ding.
4. **Uitgiftebalie van de stichting.**
   - Proces: zoekvraag → beoordeling of het lid in de doelgroep valt (casus, met toestemming) → uitgifte uit de voorraad (BR-11) → ophalen.
   - Rol: RTF-medewerker.
   - Nodig: **eigenaarsbesluit** over de zichtbaarheid van de voorraad.
5. **Productveiligheidsbewaking.**
   - Proces: terugroepacties volgen → risicocategorieën bijhouden → bij een terugroepactie de gevers van een open aanbod in die categorie één bericht klaarzetten (bevestiging door een medewerker).
   - Nodig: een externe bron (NVWA of fabrikanten; geen gegevens over een koppeling) en een **eigenaarsbesluit** over een nieuwe externe koppeling.
6. **Uitleen van gereedschap in de buurt.**
   - Proces: een uitleenvoorwerp met kalibratie en storing bestaat al voor de apparatuur van het Living Lab (`server/kern/livinglab/uitleen.js`: aangevraagd → toegekend → meegegeven → terug → afgerond).
   - Een buurtuitleen zou die kern moeten hergebruiken in plaats van een tweede uitleenmotor te bouwen. Dat is een **eigenaarsbesluit** (uitbreiding van een bestaande kern naar een niet-onderzoeksdoel) en raakt besluit 1 (geen nieuw domein vóór V1).
7. **Bezorging door een verhuizer (genre `verhuizer`) of door vrijwilligers.**
   - Dit is een nieuw domein, vraagt een gegevenspoort `bezorging` en is **eigenaarsbesluit** plus "niet vóór V1".

Huisregels die ook in B gelden: geen score op gevers, ontvangers of moderators; geen ranglijst "meest gegeven"; bevestigen doet de mens bij elk bericht naar een ander; kinderen komen er niet in zonder eigen account; geaggregeerd naar de gemeente.

### Ketens LOS en SAMEN

**LOS.** Met alle andere apps uit blijft de kerntaak intact: plaatsen, belangstelling tonen, zien wie, sluiten en melden. Het scherm zegt dan eerlijk: "Wie belangstelling toont, zie jij — en jij bepaalt wat je ermee doet. Er wordt niets verstuurd." Dat staat er vandaag al. Zonder Berichten zegt BR-06: "Contact loopt buiten de app; je ziet hier de codenaam." Is er geen open stad, dan geeft de lijst 409 met de naam van de stad en de zin dat er geruild kan worden zodra de afdeling open is.

**SAMEN — keten "kinderfiets naar de buren":**
1. Ouder A plaatst een kinderfiets (Buurtruil, eigenaar Buurtruil).
2. Buur B toont belangstelling (Buurtruil).
3. A kiest B en bevestigt het klaargezette bericht (Buurtruil zet klaar, Berichten `comm.berichten` verstuurt).
4. A en B spreken een ophaalmoment af; ieder zet het in de eigen Agenda (`agenda.afspraken`).
5. A meldt het aanbod als `weg` (Buurtruil).
6. B bedankt zonder score (Berichten).
7. Telling per kwartaal naar de gemeente, met k-drempel (RTF-kantoor, `gemeente.js`).

Storingen:
- **Berichten valt uit:** stap 3 meldt "Je bericht is niet verstuurd; het aanbod staat nog op open." Er komt geen toezegging zonder verstuurd bericht, en A ziet de codenaam van B om het later opnieuw te proberen.
- **Agenda valt uit:** stap 4 zegt "Niet in je agenda gezet"; de toezegging blijft geldig.
- **De opslag crasht tussen plaatsen en antwoord:** opnieuw plaatsen met dezelfde herhaalsleutel geeft één aanbod (voltooiproef: gesloten).
- **De stad wordt gesloten:** de lijst geeft 409 met reden; A ziet zijn aanbod nog onder Mijn aanbod.
- **Twee meldingen zonder werkvoorraad (vandaag):** het aanbod verdwijnt en niemand kijkt ernaar. Dat is de reden dat BR-10 vooraan staat.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | elke kernfunctie uit tabel b staat op "ja" of op een benoemde "niet doen"-regel | tabel b opnieuw invullen tegen de code; geen "nee" zonder reden |
| professionele diepte | elke professionele rol werkt binnen een bestaand genre of een bestaande kantoorrol, en het scherm belooft geen controle die er niet is | grep op de zin "RTG heeft het niet gecontroleerd" bij elk zelfverklaard veiligheidsantwoord; toets op BR-13 |
| levenscyclus | elk aanbod komt in een eindstand (`weg`, `ingetrokken`, `verlopen`, `gesloten`) en wordt na de termijn opgeschoond | voltooiproef uitgebreid met verlopen, beoordeling en opschonen; toets op BR-17 |
| samenwerking en rollen | gever, ontvanger en stichting hebben elk een eigen handeling, en niemand kan die van een ander doen | BEVOEGD-kruisparen voor sluiten, toezeggen en beoordelen; IDOR-meting met een echte id van A (vandaag 6 "onbereikbaar") |
| domeinintelligentie | elke suggestie (BR-15) en elke veiligheidszin (BR-13) staat als "voorstel" of "volgens de gever", nooit als feit | schermtoets op de woordkeus; geen automatisch bericht in de code (grep op verzendaanroepen in `ruil.js`) |
| los functioneren | met Berichten en Agenda uit werken plaatsen, belangstelling en sluiten volledig | voltooiproef met de koppelingen uitgezet |
| RTG-ketens | de keten "kinderfiets naar de buren" sluit van stap 1 tot 7, met de storingen zoals beschreven | ketenproef over Buurtruil, Berichten en Agenda; per schakel een uitvaltoets |
| bewezen betrouwbaarheid | de acht APPWERKT-bewijzen staan op BEWEZEN in het centrale register, inclusief menselijk en IDOR met een bereikbare id | `APPWERKT.json` na hermeting; `IDOR.json` zonder "onbereikbaar" voor deze zes routes |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar volgens SCHERMEIGENAAR.json | geen dubbele logica: wat de Buurtruil alleen verwijst |
|---|---|---|
| een bericht aan de gekozen belangstellende | `apps/comm.html`, `comm.berichten` (`apps/berichten.html` is een alias daarheen) | de Buurtruil zet de ontvanger-codenaam en de ruil-id klaar; het versturen en de berichtopslag zijn van Berichten |
| een ophaalmoment | `apps/agenda.html`, `agenda.afspraken` | alleen de ruil-id in de afspraak |
| eigen gegevens inzien | `link:gegevens` (`/apps/mijn-gegevens.html`); twijfel: niet in de lijst van SCHERMEIGENAAR.json gezien, aan de integrator voorleggen | projectie van de eigen rijen |
| oordeel over gemelde aanbiedingen | `apps/foundation/kantoor.html`, `kantoor.rtfbeheer` | de kern levert `gemeld()`; het scherm van het kantoor toont en oordeelt |
| iets kopen van de stichting | `apps/foundation/winkel.html`, `rtf.winkel` | de Buurtruil noemt nooit een prijs; hooguit "liever iets kopen? → winkel" |
| "doorgeven" in het ontdeknetwerk | `apps/connect.html`, `ontdekken.connect` ("iets ontdekken, leren, maken of doorgeven") | twijfel: aan de integrator voorleggen of "doorgeven" in Connect en de Buurtruil hetzelfde is; geen tweede ruilregister bouwen |
| gemeente ziet hergebruik | `apps/foundation/os-portaal.html`, `portaal.toegang` | alleen het geaggregeerde getal met k-drempel |
| reparatieavonden | RTF-activiteiten (kantoor van de stad); twijfel welk scherm eigenaar is, aan de integrator voorleggen | alleen de verwijzing |
| vrijwilligers als moderator | `apps/foundation/os-vrijwilliger.html`, `werk.vrijwilligerswerk` | de Buurtruil kent geen vrijwilligersrol; dat blijft daar |


---

## 2. Geven — `link:geven`, `/apps/foundation/geven.html`

Geven is de plek waar een lid met een eigen account geld geeft aan de RTFoundation: eenmalig, geoormerkt op een lopend project, of periodiek met een meerjarige overeenkomst en een SEPA-machtiging (SCHERMEIGENAAR.json: `geven.doneren`, rol eigenaar, doelgroep `lid`). De kern is de volgorde uit GIFT.md en GRAMMATICA.md: eerst ziet de gever wat er zou gebeuren (gift of sponsoring, wel of niet eerst beoordeeld, welk stuk hij terugkrijgt, wat de ANBI-stand betekent), en pas dan bevestigt hij. De server rekent bij de bevestiging alles opnieuw. Het geld loopt langs RTG Pay naar de wallet van de stichting (`pay.partnerIn`). Er komt geen tweede betaalweg bij. De knop staat **in productie standaard dicht** (`server/kern/rtfos/gift.js`): open kan alleen met een ontvangende wallet en minstens één vorm, en dat zet de boardroom.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | 3 stappen gesloten (afgeleid) | |
| voltooibaar | GEEN_FIXTURE | 8 stappen gesloten | stand open met drie vormen; voornemen + bevestiging; geoormerkt (verzonnen id geweigerd); plan + vastleggen door het kantoor; machtiging tekenen en intrekken; 3 bevoegdheidsstappen. Met gratis account, gekeurd paspoort en echt geld via de simulatiebank |
| waarheidsgetrouw | BEWEZEN | — | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | plan + ingetrokken machtiging na herstart; twee giften als bron op een codenaam; nieuwe sessie |
| bevoegd | BEWEZEN | — | BEVOEGD.json 1/1 |
| herstelbaar | GEEN_FIXTURE | 4 stappen gesloten | dubbele tik bevestigen; dubbele tik voorstellen; afgebroken bevestiging; crash na bevestiging |
| IDOR | — | — | 10 routes "onbereikbaar" (niet bewezen) |

De proef zegt zelf (`scripts/lib/voltooi/geven.js`, `grens`): "De doneerknop staat in productie dicht (GIFT.md); de eigenaar van de testwereld zet hem open, dus dit bewijst de keten erachter en niet dat de knop open hoort." De rail is de simulatiebank en er loopt geen incasso.

Wat de code doet (gelezen):
- **Routes voor leden** (`server/routes/rtfos/ruil.js`, onderaan): `gift/stand`, `gift/voorbereid`, `gift/plan/voorstel|mijn|stop`, `gift/projecten`, `gift/machtiging/mijn|teken|intrek` en `gift/bevestig`, plus de winkelroutes. Allemaal `auth` + `geenGast`; de codenaam komt uit de sessie, "anders geeft de een namens de ander".
- **Routes voor het kantoor** (`server/routes/rtfos/index.js`): `gift/stand/kantoor` (lezen, boardroom of kantoor), `gift/plan/lijst` en `gift/plan/vastleggen` (`officeAuth`), `gift/stand/zet` (boardroom).
- **Stand** (`gift.js`): dicht of open, ontvanger `wallet` + code, vormen `eenmalig`, `geoormerkt` en `periodiek`, ANBI-stand `onbekend`, `nee`, `aangevraagd` of `ja` (met een RSIN van negen cijfers alleen bij `ja`). `ontbreekt()` geeft een lijst van wat er nog nodig is. De ANBI-stand blokkeert niet, maar bepaalt wel de naam van het stuk.
- **Voornemen** (`gift-voornemen.js`): bedrag, vorm, project (de naam komt van de server), tegenprestatie → `sponsoring` met factuur, drempel uit `herkomst.js` (`DREMPEL_CENTEN` = € 10.000) → `beoordeeldVooraf`. Het stuk is `factuur`, `giftbewijs` of `ontvangstbevestiging`, met zinnen uit `anbiZin()` en de regel "Er is niets betaald en niets vastgelegd."
- **Bevestigen** (`gift-betalen.js`): opnieuw rekenen → `pay.partnerIn` met een herhaalsleutel → bron via `bronUitGift` (idempotent, herkomstcontrole) → eventueel termijn aftekenen. De kosten gaan van de ontvanger af en staan in het antwoord. Zonder betaallaag volgt 503 met "er is niets afgeschreven". Mislukt de bron na de betaling, dan staat dat in het antwoord. GIFT.md par. 6 meldt een gift van € 25 met € 0,35 kosten in het echte grootboek.
- **Projecten** (`gift-projecten.js`): alleen actieve projecten in actieve steden; het filter `soort` is een beeld en geen grens.
- **Periodiek** (`gift-periodiek.js`): plannen `voorgesteld`, `vastgelegd` of `gestopt`; minimaal `JAREN_MIN = 5`; vast jaarbedrag; termijnen afgeleid uit startjaar en looptijd. `openDitJaar` rekent de server uit. Vastleggen vraagt een kenmerk en een einddatum; maximaal vijf lopende plannen per gever.
- **Machtiging** (`gift-machtiging.js` op `server/kern/machtiging.js`): per plan; maximum ≥ jaarbedrag; `geindNu: false`; storno 8 weken, onterecht 13 maanden, aankondiging 14 dagen. Intrekken stopt de incasso en niet de gift; een gestopt plan laat de machtiging vervallen. `aankondiging(planId)` bestaat in de kern, maar **geen route roept hem aan** (gezocht in `server/routes/rtfos/`).
- **Herbestemmen** (`geld-bron.js: verplaats`): alleen landelijk, `nooit` is een harde grens, `met_toestemming` vraagt `toestemming: true`, het bestede deel blijft achter.
- **Donateursportaal** (`donateur.js`, `donateur-kantoor.js`): werkt op een RTFS-code die het kantoor uitgeeft en aan giften bindt (`donateur_subject_id`, `persoonscode_id`). Een online gift (`bronUitGift`) krijgt die velden niet vanzelf. Het scherm zegt toch "je gift komt op je eigen naam in het donateursportaal te staan" (`geven.html`, poortblok). Dat klopt alleen nadat het kantoor een code heeft uitgegeven en de gift heeft gekoppeld. Zie GV-07.
- **Kantoorscherm:** `kantoor.html` toont en zet de giftstand. **Geen scherm onder `public/` roept `gift/plan/lijst` of `gift/plan/vastleggen` aan** (gezocht); de voltooiproef gebruikt de route rechtstreeks. Zie GV-10.
- **ANBI-grondslag** (`anbi-grondslag.js`): het jaarstuk zegt `publicatieplicht` alleen bij `ja`, anders `eigen keus`.
- **Scherm** (`geven.html`): de stappen voornemen en bevestigen; de herhaalsleutel wordt één keer gemaakt bij het tonen van het voornemen; `?project=` uit het Klimaatfonds zet de vorm op geoormerkt; een blok voor meerjarig geven met machtiging; een doorverwijzing naar de winkel met de zin dat een aankoop geen aftrekbare gift is. Het scherm stuurt **geen `stad`** mee (`invoer()`), dus `bron.stad` is bij een online gift `null`.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Givebutter | Free (bronnen spreken elkaar tegen), Plus per contactband, Enterprise (duurste) | Plus $29 / $79 / $129 per maand voor 250 / 1.000 / 2.500 contacten; Enterprise op maat; 3% platformfee als donortips uit staan (secundaire bron) | terugkerende donaties, donor-CRM | Givebutter — https://givebutter.com/features/recurring-donations (zoekresultaat 2026-10-19, pagina niet geopend); ToolRadar — https://toolradar.com/tools/givebutter/pricing (zoekresultaat 2026-10-19, pagina niet geopend); Pulse Signal — https://getpulsesignal.com/pricing/givebutter (zoekresultaat 2026-10-19, pagina niet geopend) |
| JustGiving | maandelijkse donaties (alleen VK) | geen gegevens | maandelijks geven aan een fondsenwervingspagina | JustGiving — https://help.justgiving.com/hc/en-us/articles/9178854870033-Monthly-donations-to-a-Fundraising-page-UK-only (zoekresultaat 2026-10-19, pagina niet geopend) |
| Geef.nl | geen gegevens over pakketten | geen gegevens | ANBI- en CBF-weergave, teamacties | Geef.nl — https://www.geef.nl/nl/page/faq-actievoeren (zoekresultaat 2026-10-19, pagina niet geopend) |
| Blackbaud Raiser's Edge NXT (duurste segment) | abonnement op offerte | vanaf $5.600 per jaar volgens een ongedateerde gids; verder op aanvraag | donorbeheer, giftverwerking, pledge management, terugkerende en nalatenschapsgiften, campagnes; vrijwilligersbeheer en prospectonderzoek als betaalde extra's | Tech Impact — https://guides.techimpact.org/donor-management-systems/?p=769 (zoekresultaat 2026-10-19, pagina niet geopend); G-Cloud — https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/266434168419207 (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| eenmalig geven | ja |
| geoormerkt op een project | ja (alleen lopende projecten, de naam van de server) |
| terugkerend geven | half: een periodiek plan met machtiging, maar geen incasso-rail (`geindNu: false`) en alleen jaarlijks |
| fiscaal juiste stukken | ja: giftbewijs, ontvangstbevestiging of factuur volgens de ANBI-stand en de tegenprestatie |
| donoroverzicht / jaaroverzicht | half: het donateursportaal op een code van het kantoor, niet automatisch vanuit het account |
| donor-CRM, segmentatie | nee, bewust: geen adressenlijst voor werving (`donateur.js` grendel 1) |
| fondsenwervingspagina's door leden, teamacties | nee (zie GV-N3) |
| transparantie over besteding | half: bestemming op projectniveau in het portaal; geen publiek bestedingsbeeld per project (`publiek.js`: "geen bedragen per project") |
| nalatenschap | elders (`geld.html#nalatenschap`) |

### c. Het volledige domein

**Particulier.** Mensen geven los (collecte, online, sms), maandelijks via een incasso, of met een periodieke gift voor de belastingaftrek. Volgens het zoekresultaat van de Belastingdienst en modelformulieren geldt bij een periodieke gift: een schriftelijke overeenkomst (notarieel of onderhands met de instelling), minimaal vijf jaar, vaste en gelijkmatige uitkeringen, vrijwillig en zonder tegenprestatie, een ANBI (of bepaalde vereniging) als ontvanger, en een partner die meetekent (Belastingdienst — https://belastingdienst.nl/wps/wcm/connect/nl/aftrek-en-kortingen/content/verschil-periodieke-giften-gewone-giften (zoekresultaat 2026-10-19, pagina niet geopend); modelovereenkomst — https://download.belastingdienst.nl/belastingdienst/docs/overeenkomst_period_gift_in_nat_ib0812z9fol.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Protestantse Kerk modelovereenkomst — https://protestantsekerk.nl/download4881/Modelovereenkomst periodieke gift-Kerkelijke-gemeente 2016.pdf (zoekresultaat 2026-10-19, pagina niet geopend), dat art. 88 boek 1 BW noemt voor de partnerhandtekening). Volgens de modelformulieren in het zoekresultaat eindigt de gift bij overlijden, arbeidsongeschiktheid of werkloosheid. Bij gewone giften noemen zoekresultaten een drempel van 1% van het drempelinkomen met een minimum van € 60 en een maximum van 10% (Consumentenbond — https://www.consumentenbond.nl/belastingaangifte/geven-goed-doel (zoekresultaat 2026-10-19, pagina niet geopend); ALS — https://www.als.nl/schenken-aan-een-goed-doel (zoekresultaat 2026-10-19, pagina niet geopend)). De multiplier voor culturele ANBI's verschijnt in de zoekresultaten, maar de stand in 2026 is niet bevestigd (Taxence — https://www.taxence.nl/nieuws/multiplier-voor-giften-aan-anbis-onjuist-toegepast/ (zoekresultaat 2026-10-19, pagina niet geopend)), en de RTFoundation is geen culturele instelling. Daar volgt voor deze app dus niets uit.

**Professioneel.** Er werken fondsenwervers, donateursadministratie, notarissen (periodieke akte), belastingadviseurs en accountants (jaarverslag). In het genre-register staan `professioneel` (Professionele diensten) en `zzp`, zonder persoonseis; een notaris of fiscalist heeft hier dus geen gecontroleerde rol. Fiscale uitkomsten vallen onder de vier klassen van `server/kern/fiscaal/zekerheid.js`.

**Organisatorisch.** Een goed doel heeft een ANBI-beschikking nodig (aangevraagd: de stand in `gift-vormen.js` per 31 augustus 2026). Een ANBI moet publiceren: naam, RSIN, contactgegevens, doelstelling, hoofdlijnen van het beleidsplan, bestuurssamenstelling met namen, beloningsbeleid, actueel verslag, balans en staat van baten en lasten (Belastingdienst standaardformulier — https://download.belastingdienst.nl/belastingdienst/docs/standaardform-publicatieplicht-fondsen-ib1151z3fol.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Taxlive — https://www.taxlive.nl/nl/documenten/nieuws/deloitte-nieuwe-publicatieplicht-voor-anbis/ (zoekresultaat 2026-10-19, pagina niet geopend)). De CBF-Erkenning is de kwaliteitsstandaard van de sector, met aparte normen voor kleine organisaties. Sinds een convenant met de Belastingdienst geldt: wie aan de Erkenning voldoet, voldoet ook aan de ANBI-eisen (Goede Doelen Nederland normen tot 50k — https://goededoelennederland.nl/downloads/over-de-sector/2022-Normen-Erkenningsregeling-A-tot-50k-vastgesteld-13-september-2022-ingaande-1-oktober-2022.pdf (zoekresultaat 2026-10-19, pagina niet geopend); convenant — https://download.belastingdienst.nl/belastingdienst/docs/convenant_erkenningsreg_goede_doelen_al12801z1ed.pdf (zoekresultaat 2026-10-19, pagina niet geopend)). Herkomst van grote giften: in dit huis staat geld boven € 10.000 (of € 500 contant) stil tot een mens kijkt (`herkomst.js`).

**SEPA-incasso.** Een incasso vraagt een bankcontract en een incassant-ID op naam van de stichting; dat heeft dit huis niet (GIFT.md par. 8). De storneringstermijnen (8 weken, 13 maanden bij onterecht) en de aankondiging staan op één plek (`server/kern/machtiging.js`).

**Wat daaruit volgt voor de app.**
1. Het fiscale stuk moet de ANBI-stand volgen. Dat doet het al, en het hoort zo te blijven.
2. De periodieke overeenkomst mist twee elementen uit de modelovereenkomst: de **partnerhandtekening** en de **eindigingsgronden** (GV-08, GV-17).
3. Het jaaroverzicht hoort vanzelf bij de gever te komen in plaats van via een kantoorcode (GV-07).
4. Het kantoor heeft een scherm nodig om plannen vast te leggen (GV-10).
5. De incasso blijft een besluit met een externe afhankelijkheid (bank).

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** de kern staat en is met echt geld bewezen; de gaten zijn het jaaroverzicht op het eigen account en de partnerhandtekening.
- **L2 Professioneel via bestaande genres:** er is geen gecontroleerd genre voor notaris of fiscalist; hooguit het kenmerk van een notariële akte bij het vastleggen.
- **L3 Organisatorisch:** stand, herkomst en vastleggen bestaan; het kantoor mist een scherm voor plannen en een route voor de aankondiging.
- **L4 Domeinintelligentie:** de fiscale zinnen zijn streng en juist ingedeeld; een aftrekberekening hoort niet hier maar bij de aangifte (verwijzing).
- **L5 Volledige levenscyclus:** van voorstel tot gestopt bestaat; einde van de looptijd, overlijden en storno-afhandeling ontbreken.
- **L6 RTG-samenhang:** Klimaatfonds → Geven werkt; het jaaroverzicht naar de aangifte en de nalatenschap zijn verwijzingen.

**GV-01 Giftstand lezen met de reden waarom hij dicht is** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `giftstand` in de rtfos-opslag (`gift.js: stand()`).
- Regels en rekenwijze: dicht is de standaard; `ontbreekt()` zegt welk besluit openstaat.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: elk lid met een account ziet de stand en de uitleg ("Dit is geen storing maar een stand").
- Rollen en toestemming: lezen kan elk lid; zetten alleen de boardroom.
- Uitzonderingen: zonder account een inlogpoort.
- Acceptatiecriterium: Gegeven een dichte stand zonder wallet, wanneer een lid Geven opent, dan ziet hij dat RTG geen giften aanneemt en dat er een besluit openstaat, en er is geen bevestigknop.

**GV-02 Voornemen: wat er zou gebeuren** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `gift-voornemen.js`; de drempel uit `herkomst.js`; zinnen uit `gift-vormen.js: anbiZin()`.
- Regels en rekenwijze: een tegenprestatie maakt het sponsoring met een factuur; ≥ € 10.000 wordt eerst beoordeeld; aftrekbaar alleen als er geen tegenprestatie is en de ANBI-stand `ja` is.
- Onzekerheid: klasse **bepaald** voor "gift of sponsoring" als de gever eerlijk antwoordt; **voorbehouden/onbekend** voor aftrekbaarheid zolang de beschikking er niet is. De zin zegt "dat zeggen wij niet toe".
- Wie hoort wat, wanneer: alleen de gever, vóór bevestigen.
- Rollen en toestemming: een eigen account.
- Uitzonderingen: een gesloten vorm geeft 409 met de open vormen.
- Acceptatiecriterium: Gegeven ANBI-stand `aangevraagd`, wanneer een lid € 25 voorbereidt, dan krijgt hij "ontvangstbevestiging", "nu niet aftrekbaar" en "Er is niets betaald", en er is geen boeking in RTG Pay.

**GV-03 Bevestigen met echt geld, één keer** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `gift-betalen.js`, `pay.partnerIn`, `geld-bron.js: bronUitGift`.
- Regels en rekenwijze: opnieuw rekenen; herhaalsleutel; de bron ná de boeking; de kosten van de ontvanger af en zichtbaar.
- Onzekerheid: een mislukte bronregistratie na de betaling wordt gemeld ("het geld is niet weg").
- Wie hoort wat, wanneer: de gever ziet het bedrag, de kosten en het stuk; boven de drempel krijgt het bestuur een herkomstcontrole (`os-bestuur.html`, `kantoor.governance`, tab "Grote giften").
- Rollen en toestemming: een eigen account; opladen vraagt een gekeurd paspoort (payGate).
- Uitzonderingen: zonder betaallaag 503 en niets afgeschreven.
- Acceptatiecriterium: Gegeven een lid met saldo, wanneer hij twee keer met dezelfde sleutel € 30 bevestigt, ook na een crash ertussen, dan is er één afschrijving en één bron (voltooiproef: gesloten).

**GV-04 Geoormerkt op een lopend project** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `gift-projecten.js`; `S().projecten`.
- Regels en rekenwijze: alleen actieve projecten in actieve steden; de naam komt van de server; herbestemmen alleen met toestemming.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gever ziet de projectnaam; de stichting ziet een bron met `projectId`.
- Rollen en toestemming: een eigen account.
- Uitzonderingen: een verzonnen id geeft 400.
- Acceptatiecriterium: Gegeven een verzonnen `projectId` en een meegestuurde naam "Bestaat Niet", wanneer het lid bevestigt, dan weigert de server en ontstaat er geen bron (voltooiproef: gesloten).

**GV-05 Periodiek plan: voorstellen, zien, stoppen** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `S().giftplannen` (`gift-periodiek.js`).
- Regels en rekenwijze: minimaal vijf jaar; vast jaarbedrag; maximaal vijf lopend; termijnen afgeleid; alleen de termijn van dit jaar staat open.
- Onzekerheid: wat stoppen fiscaal betekent, zegt het systeem bewust niet ("staat in de overeenkomst zelf").
- Wie hoort wat, wanneer: de gever ziet de stand en de zinnen; het kantoor ziet het plan in de lijst.
- Rollen en toestemming: voorstellen en stoppen doet de gever; vastleggen het kantoor.
- Uitzonderingen: korter dan vijf jaar geeft 400 met de uitleg dat het dan een gewone gift is.
- Acceptatiecriterium: Gegeven een vastgelegd plan van vijf jaar, wanneer een ander lid het probeert te stoppen, dan krijgt hij 403 en blijft het plan vastgelegd (voltooiproef: gesloten).

**GV-06 SEPA-machtiging tekenen en intrekken** · L1 · bestaat (half: geen incasso) · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `S().giftmachtigingen`; regels in `server/kern/machtiging.js`.
- Regels en rekenwijze: per plan; maximum ≥ jaarbedrag; alleen de laatste vier cijfers (`ibanEinde`); een tweede vervangt de eerste; intrekken stopt de incasso en niet de gift.
- Onzekerheid: er wordt niets geïnd (`geindNu: false`); elk antwoord zegt het.
- Wie hoort wat, wanneer: de gever ziet het kenmerk, de 14 dagen aankondiging, de 8 weken storno en de 13 maanden bij onterecht.
- Rollen en toestemming: alleen de gever tekent; er is geen kantoorroute om namens iemand te tekenen.
- Uitzonderingen: een gestopt plan heeft geen machtiging.
- Acceptatiecriterium: Gegeven een machtiging, wanneer de gever hem intrekt, dan is hij inactief en staat het plan nog op `vastgelegd` (voltooiproef: gesloten).

**GV-07 Mijn giften en jaaroverzicht op het eigen account** · L1 · half · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: de bronnen met `uitGift: true` en `gever` = de eigen codenaam (`geld-bron.js`). Vandaag zijn ze alleen zichtbaar via een RTFS-code die het kantoor uitgeeft en bindt (`donateur-kantoor.js`).
- Regels en rekenwijze: een projectie op de eigen codenaam, alleen eigen giften (grendel 1 van `donateur.js`). Het jaaroverzicht telt per kalenderjaar; het stuk per gift volgt `bewijsbaar()`. Bedragen zijn klasse **bepaald**; aftrekbaarheid volgt de ANBI-stand van het moment van geven (een eigenaarsbesluit: welk moment telt bij een stand die verandert).
- Onzekerheid: een gift met een open herkomstcontrole heeft nog geen bewijs.
- Wie hoort wat, wanneer: alleen de gever, als hij kijkt.
- Rollen en toestemming: een eigen account; het kantoor ziet niets extra.
- Uitzonderingen: giften van vóór een account (contant, overboeking) blijven via de RTFS-code lopen.
- Acceptatiecriterium: Gegeven een lid dat in 2026 twee online giften deed, wanneer hij "mijn giften" opent, dan ziet hij precies die twee met datum, bedrag, kosten en stuk, zonder dat het kantoor eerst een code hoefde uit te geven. De zin "komt op je eigen naam in het donateursportaal" klopt dan.

**GV-08 Partner tekent mee bij de periodieke overeenkomst** · L1 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: in het voorstel een veld "fiscale partner: ja/nee" en, bij ja, de stand "partnerhandtekening ontbreekt/aanwezig". De naam van de partner staat in de kluis of op het papieren stuk, nooit in `giftplannen`.
- Regels en rekenwijze: het kantoor kan een plan met "ja" niet vastleggen zonder dat de handtekening is gezien. Grondslag: de modelovereenkomst in het zoekresultaat (art. 88 boek 1 BW); de juridische toets is mensenwerk.
- Onzekerheid: RTG controleert niet of iemand een fiscale partner heeft; het is een verklaring van de gever.
- Wie hoort wat, wanneer: de gever ziet wat er ontbreekt; het kantoor ziet de stand.
- Rollen en toestemming: de gever verklaart; het kantoor tekent af.
- Uitzonderingen: zonder partner geen eis.
- Acceptatiecriterium: Gegeven een voorstel met "fiscale partner: ja", wanneer het kantoor vastlegt zonder dat de handtekening als gezien is gemarkeerd, dan weigert de server met de reden.

**GV-09 Notariële akte als grondslag** · L2 · half (vastleggen kent alleen een kenmerk) · kosten klein · complexiteit laag · later
- Gegevens en bron: een veld `soortStuk: onderhands|notarieel` bij het vastleggen.
- Regels en rekenwijze: beide vormen zijn volgens het zoekresultaat geldig; de vorm verandert niets aan de termijnen.
- Onzekerheid: de inhoud van de akte beoordeelt RTG niet.
- Wie hoort wat, wanneer: de gever ziet de soort.
- Rollen en toestemming: het kantoor; een notaris heeft geen eigen rol (geen genre met persoonseis).
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een notariële akte, wanneer het kantoor het plan vastlegt met `notarieel` en een aktekenmerk, dan toont het plan "notariële overeenkomst" met dat kenmerk.

**GV-10 Kantoorscherm: plannen vastleggen** · L3 · half (route bestaat, geen scherm) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `POST /api/rtfos/gift/plan/lijst` en `/vastleggen` (`officeAuth`).
- Regels en rekenwijze: een lijst met voorgestelde plannen; vastleggen met kenmerk en einddatum. Lezen mag het kantoor; de handeling gaat in de audit.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gever ziet "vastgelegd onder kenmerk …" bij zijn volgende bezoek.
- Rollen en toestemming: een RTF-kantoormedewerker.
- Uitzonderingen: een gestopt plan kan niet worden vastgelegd (409).
- Acceptatiecriterium: Gegeven een voorgesteld plan, wanneer een medewerker het op `kantoor.html` vastlegt, dan ziet de gever het vastgelegd met het kenmerk. Een lid zonder kantoortoken krijgt op de route 401 of 403.

**GV-11 Aankondiging van een termijn klaarzetten** · L3 · half (kern `aankondiging()` bestaat, route ontbreekt) · kosten klein · complexiteit laag · later
- Gegevens en bron: `gift-machtiging.js: aankondiging(planId)`.
- Regels en rekenwijze: 14 dagen vooraf; klaarzetten en niet versturen; een medewerker bevestigt het versturen.
- Onzekerheid: zonder incasso-rail is de aankondiging een herinnering en geen incasso-aankondiging; de tekst moet dat zeggen.
- Wie hoort wat, wanneer: de gever, na bevestiging door het kantoor.
- Rollen en toestemming: het kantoor.
- Uitzonderingen: geen actieve machtiging → "elke termijn bevestigt de gever zelf".
- Acceptatiecriterium: Gegeven een plan met actieve machtiging, wanneer het kantoor de aankondiging opvraagt, dan ziet het een tekst met kenmerk en `geindNu: false`, en er gaat niets weg zonder bevestiging.

**GV-12 Herkomstcontrole boven de drempel** · L3 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `herkomst.js`; tab "Grote giften" in `os-bestuur.html`.
- Regels en rekenwijze: € 10.000, of € 500 contant: het geld staat stil tot een mens kijkt. Er is geen automatische FIU-melding en geen sanctielijst (GIFT.md par. 5).
- Onzekerheid: het oordeel is mensenwerk.
- Wie hoort wat, wanneer: de gever ziet vooraf dat het wordt beoordeeld.
- Rollen en toestemming: het bestuur.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een gift van € 12.000, wanneer hij bevestigd is, dan staat de bron op "herkomstcontrole open" en is hij niet besteedbaar tot het bestuur heeft beoordeeld.

**GV-13 Herbestemmen met toestemming van de gever** · L3 · half (de regel bestaat, het toestemmingsverzoek niet) · kosten klein · complexiteit midden · later
- Gegevens en bron: `geld-bron.js: verplaats`; de toestemming nu als `toestemming: true` met een bewijsstuk buiten het systeem.
- Regels en rekenwijze: het kantoor zet een verzoek klaar; de gever bevestigt of weigert zelf in Geven; pas dan kan het landelijke bestuur verplaatsen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gever krijgt het verzoek met reden; zonder antwoord blijft het geld waar het is.
- Rollen en toestemming: de gever geeft toestemming; het landelijke bestuur verplaatst.
- Uitzonderingen: `nooit` is een harde grens; dan rest bestemming of teruggave.
- Acceptatiecriterium: Gegeven een geoormerkte bron, wanneer de gever het verzoek weigert, dan geeft `verplaats` 400 en staat het geld nog op het oude project.

**GV-14 ANBI- en verantwoordingspagina** · L3 · half (`anbi-grondslag.js` + jaarverslag bestaan) · kosten klein · complexiteit laag · later
- Gegevens en bron: het jaarstuk en de grondslag (`publicatieplicht` of `eigen keus`).
- Regels en rekenwijze: de publicatie-items uit het standaardformulier verschijnen pas bij `ja`. Zolang de stand `aangevraagd` is, staat er "eigen keus" en geen RSIN. Een getal dat niet bestaat, wordt geen nul.
- Onzekerheid: de beschikking.
- Wie hoort wat, wanneer: publiek.
- Rollen en toestemming: het bestuur stelt vast.
- Uitzonderingen: bestuursnamen kunnen bij een reëel veiligheidsrisico achterwege blijven, mits de inspecteur instemt (zoekresultaat).
- Acceptatiecriterium: Gegeven ANBI-stand `aangevraagd`, wanneer iemand de verantwoordingspagina opent, dan staat er "eigen keus" en geen RSIN.

**GV-15 Besteding volgen op projectniveau** · L4 · half (het portaal kent de bestemming) · kosten middel · complexiteit midden · later
- Gegevens en bron: `bron.besteed` en de projectstand; een projectie per bron van de gever.
- Regels en rekenwijze: impact op projectniveau, nooit op mensniveau (grendel 2 van `donateur.js`); geen aantallen hulpvragen per wijk.
- Onzekerheid: "besteed" is een boeking, geen effect. Effect hoort bij de bewijsgraad van een onderzoek (Klimaatfonds/Living Lab).
- Wie hoort wat, wanneer: alleen de gever.
- Rollen en toestemming: de gever.
- Uitzonderingen: een bron met herkomstcontrole open: "nog niet besteedbaar".
- Acceptatiecriterium: Gegeven een geoormerkte gift van € 10 waarvan € 6 is besteed, wanneer de gever kijkt, dan ziet hij "€ 6 besteed aan [project]" en geen naam, aantal of wijkcijfer.

**GV-16 Aftrekberekening voor de aangifte** · L4 · ontbreekt · kosten — · complexiteit — · niet doen (in deze app)
- Reden: het vraagt het drempelinkomen en de aangifte zelf. Dat is van `apps/overheid.html` (`overheid.rijk-burger`); Geven levert alleen het jaaroverzicht (GV-07) als verwijzing. Een tweede rekenmachine zou op de dag van een wetswijziging uiteenlopen.

**GV-17 Levenscyclus van het periodieke plan afmaken** · L5 · half · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `giftplannen` (`tot`, `gestoptOm`).
- Regels en rekenwijze: nieuwe standen `afgelopen` (einddatum bereikt) en `beëindigd-van-rechtswege` met een gesloten lijst gronden uit de modelovereenkomst (overlijden, arbeidsongeschiktheid, werkloosheid). Verlengen is een nieuw voorstel, geen stille verlenging.
- Onzekerheid: of een grond geldt, beoordeelt een mens; RTG zegt niets over de fiscale gevolgen.
- Wie hoort wat, wanneer: de gever (of bij overlijden de gemachtigde nabestaande via de bestaande relatielaag; twijfel welke, aan de integrator voorleggen).
- Rollen en toestemming: het kantoor zet de grond met reden; de gever ziet die.
- Uitzonderingen: lopende machtigingen vervallen mee (grendel 5).
- Acceptatiecriterium: Gegeven een plan met einddatum 2031-12-31, wanneer de datum voorbij is, dan staat het op `afgelopen`, is de machtiging vervallen en staat er geen open termijn meer.

**GV-18 Storno en terugbetaling afhandelen** · L5 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: een storno komt pas met een incasso-rail; een terugbetaling op verzoek loopt via de stichting (`gift-betalen.js`: "een gift terugdraaien loopt langs de stichting en niet langs een knop").
- Regels en rekenwijze: de stichting beslist, met reden; de bron wordt gecorrigeerd met een tegenboeking en niet gewist.
- Onzekerheid: de fiscale gevolgen voor het stuk (een ingetrokken giftbewijs).
- Wie hoort wat, wanneer: de gever.
- Rollen en toestemming: het landelijke bestuur.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een terugbetaling van een gift met giftbewijs, wanneer het bestuur hem bevestigt, dan staat er een tegenboeking, is het bewijs als vervallen gemarkeerd en is de oorspronkelijke bron nog leesbaar.

**GV-19 Geven vanuit een andere app met het project al gekozen** · L6 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `?project=<id>` vanuit `klimaatfonds.html`.
- Regels en rekenwijze: een id en geen naam; de server zoekt de naam; er is één plek om te bevestigen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gever.
- Rollen en toestemming: een eigen account.
- Uitzonderingen: een gestopt project → de vorm valt terug en de server weigert het oormerk.
- Acceptatiecriterium: Gegeven het Klimaatfonds met een actief duurzaamheidsproject, wanneer het lid op "Hieraan geven" tikt, dan staat Geven op "Voor een project" met dat project, en dezelfde id staat in beide lijsten (voltooiproef Klimaat: gesloten).

**GV-20 Stad meesturen zodat de gift in de verantwoording van een stad landt** · L3 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `bronUitGift` accepteert `stad`, maar `geven.html` stuurt hem niet mee (`invoer()`). Bij een geoormerkte gift is de stad af te leiden uit het project.
- Regels en rekenwijze: bij een oormerk neemt de server de stad van het project; zonder oormerk blijft het "landelijk", en dat moet er dan ook zo staan.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het kantoor van die stad ziet de bron.
- Rollen en toestemming: geen extra.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een geoormerkte gift aan een project in Zwolle, wanneer hij bevestigd is, dan heeft de bron `stad` = Zwolle en niet `null`.

**GV-21 Nalatenschap** · L6 · elders · niet doen (in deze app)
- Reden: `link:nalatenschap` (`/apps/geld.html#nalatenschap`) is de plek; Geven verwijst er hooguit naar.

**GV-N1 Thermometer, teller "nog € 400 te gaan", ranglijst gevers, badges** · niet doen — GIFT.md par. 5: druk en een score op een mens.

**GV-N2 Incasso zonder bankcontract of een knop "maandelijks" die fiscaal geen periodieke gift is** · niet doen — nooit claimen dat een boeking is verwerkt (GIFT.md par. 5 en 8).

**GV-N3 Fondsenwervingspagina's of teamacties door leden (peer-to-peer)** · niet doen (nieuw domein vóór V1) — het vraagt een eigen verantwoordingsketen per actie en zet sociale druk op mensen.

**GV-N4 Automatisch afronden of "geef bij elke betaling" (round-up)** · niet doen — geld verlaat het huis nooit vanzelf (GELD.md, volgens GIFT.md).

### e. RTG-exclusief

1. **Van buurtvraag naar gift met belofte.** Klimaatfonds (vraag en project, eigenaar `gemeenschap.klimaatfonds`) → Geven (oormerk, eigenaar `geven.doneren`) → RTG Pay (boeking, eigenaar `betalen.rtgpay`) → bron (stichting, `kantoor.rtfbeheer`) → herbestemming alleen met toestemming. De gever ziet dezelfde project-id als de vraagsteller; er is geen gedeelde data, alleen de id.
2. **Een gift met een eerlijk fiscaal stuk.** Geven (voornemen) → giftstand (ANBI-stand, boardroom) → donateursportaal (`gift.overzicht`) → aangifte (`overheid.rijk-burger`, verwijzing). Het stuk zegt op elke plek hetzelfde, omdat de zin op één plek staat (`anbiZin`).
3. **Geven zonder adressenlijst.** De gever staat als codenaam in de bron; de echte naam blijft in de kluis. Het portaal toont alleen eigen giften. Een donor-CRM met segmentatie, zoals bij de leiders, bestaat hier bewust niet.
4. **Aankoop of gift, nooit verwisseld.** Geven ↔ Winkel (`rtf.winkel`): dezelfde wallet, twee wegen, en de winkel geeft nooit een giftbewijs (GIFT.md par. 9).

### f. Bouwstenen en ontbrekende koppelingen

Wat er staat: `server/kern/rtfos/gift.js`, `gift-vormen.js`, `gift-voornemen.js`, `gift-betalen.js`, `gift-periodiek.js`, `gift-machtiging.js`, `gift-projecten.js`, `geld-bron.js`, `herkomst.js`, `donateur.js`, `donateur-kantoor.js`, `anbi-grondslag.js`, `server/kern/machtiging.js`, `server/routes/rtfos/ruil.js` (ledendeur), `server/routes/rtfos/index.js` (kantoordeur), `public/apps/foundation/geven.html`, `GIFT.md`, `scripts/lib/voltooi/geven.js`.

| koppeling | van → naar | vorm | stand |
|---|---|---|---|
| mijn giften | bron (`uitGift`) → Geven / donateursportaal | projectie op de eigen codenaam | ontbreekt (nu alleen via een kantoorcode) |
| plannen vastleggen | kern → `kantoor.html` | scherm op een bestaande route | ontbreekt |
| aankondiging | kern → kantoor | route op een bestaande functie | ontbreekt |
| stad bij gift | Geven → bron | verwijzing (project → stad) | ontbreekt |
| jaaroverzicht naar aangifte | Geven → `apps/overheid.html` | verwijzing | ontbreekt |
| toestemming bij herbestemming | kantoor → Geven → `geld-bron.verplaats` | verwijzing (bron-id) | ontbreekt |
| projectkeuze | Klimaatfonds → Geven | id in de URL | bestaat |
| betaling | Geven → RTG Pay (`pay.partnerIn`) | bestaande betaalweg | bestaat |
| levensgraaf | Geven → `server/kern/levensgraaf/graaf.js` | projectie (lopend plan als knoop) | niet nagekeken |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| GV-07 mijn giften op het account | nu | klein | midden | eigenaarsbesluit over welk ANBI-moment telt; `donateur.js` grendels |
| GV-10 kantoorscherm plannen | nu | klein | laag | — |
| GV-08 partnerhandtekening | nu | klein | midden | juridische toets op de tekst |
| GV-17 einde van de looptijd | nu | klein | midden | GV-10; relatielaag bij overlijden (twijfel) |
| GV-20 stad bij gift | nu | klein | laag | — |
| GV-01 t/m GV-06, GV-12, GV-19 | nu (bestaat; behouden) | — | — | eigenaarsbesluit: de knop openen in productie (wallet, vorm) |
| GV-09 notariële akte | later | klein | laag | GV-10 |
| GV-11 aankondiging | later | klein | laag | incasso-rail (extern: bankcontract, incassant-ID) |
| GV-13 toestemmingsverzoek | later | klein | midden | — |
| GV-14 verantwoordingspagina | later | klein | laag | ANBI-beschikking (extern) |
| GV-15 besteding volgen | later | middel | midden | GV-07 |
| GV-18 storno en terugbetaling | later | middel | hoog | incasso-rail; eigenaarsbesluit |
| GV-16, GV-21 | niet doen hier | — | — | eigenaar elders |
| GV-N1 t/m N4 | niet doen | — | — | — |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **GV-07 + GV-10 + GV-08 + GV-17 + GV-20**, met GV-13 als het meekan. Er komt geen motor bij: het zijn projecties op bronnen die al bestaan, één kantoorscherm op bestaande routes, twee velden en twee standen in het plan.

Wat de gebruiker daarna kan wat hij nu niet kan:
- De **gever** ziet zijn eigen giften en een jaaroverzicht op zijn account, zonder te wachten op een code van het kantoor. De zin op het scherm wordt daarmee waar.
- De **gever met een fiscale partner** weet vóór het vastleggen wat er nog ontbreekt, in plaats van achteraf bij de aangifte.
- Het **kantoor** legt een periodieke overeenkomst vast op een scherm in plaats van via een losse route.
- Een plan **eindigt** netjes, met de gronden uit de modelovereenkomst, en laat geen open termijnen of volmachten achter.
- Een gift aan een project in Zwolle staat in de verantwoording van Zwolle.

Wat A niet verandert: de knop blijft in productie dicht tot de eigenaar hem opent, en er wordt niets geïnd.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **volledige geefinfrastructuur van een erkend goed doel**: ANBI met publicatie, CBF-erkenning, incasso via de eigen bank, periodieke overeenkomsten volledig digitaal, nalatenschappen, en een verantwoording die per gift laat zien waar het geld heen ging. Er komt geen donorwerving op adressenlijsten.

Nieuwe professionele processen:

1. **Donateursadministratie van de stichting.**
   - Rol: RTF-medewerker.
   - Proces: plan ontvangen → overeenkomst controleren (looptijd, vast bedrag, partner, tegenprestatie) → vastleggen → jaarlijkse termijn bewaken → einde of beëindiging vastleggen → jaaroverzicht.
   - Nodig: GV-08, GV-10, GV-17; geen nieuw genre.
2. **Incassoproces.**
   - Rol: RTF-financiën.
   - Proces: bankcontract → incassant-ID → machtiging (bestaat) → aankondiging 14 dagen (GV-11) → batch pain.008 → verwerking → storno-afhandeling (GV-18).
   - Nodig: **eigenaarsbesluit** + **extern** (bankcontract en incassant-ID op naam van de stichting, GIFT.md par. 8) + een nieuwe betaalrail. Dat is **een nieuwe koppeling en dus een besluit**.
3. **ANBI-aanvraag en publicatieplicht.**
   - Rol: bestuur en penningmeester.
   - Proces: aanvraag → beschikking → stand op `ja` met RSIN → publicatiepagina met de verplichte items → jaarlijkse actualisatie.
   - Nodig: **extern** (Belastingdienst); de publicatie-items in GV-14.
4. **CBF-erkenning.**
   - Rol: bestuur en directie.
   - Proces: normen toetsen (categorie naar omvang) → beleidsplan → aanvraag → periodieke toetsing.
   - Nodig: **extern** (CBF) en een **eigenaarsbesluit** over het aanvragen. De app toont het keurmerk pas als het er is.
5. **Notariële en digitale periodieke overeenkomst.**
   - Rol: notaris (genre `professioneel`, zonder persoonseis, dus RTG valideert niets).
   - Proces: de gever kiest notarieel → de notaris maakt de akte → het kantoor legt het aktekenmerk vast.
   - Nodig: een afspraak met een notariskantoor (extern) en een **eigenaarsbesluit** over een partnerkanaal.
6. **Nalatenschappen en legaten.**
   - Rol: RTF-medewerker met een notaris en de executeur.
   - Proces: een legaat wordt gemeld → de executeur meldt zich via het organisatieportaal → afwikkeling → bron van soort legaat met herkomstcontrole.
   - Nodig: **eigenaarsbesluit** (nieuwe bronsoort) en **extern** (notaris en executeur). Hangt aan `link:nalatenschap` in Geld en niet aan Geven.
7. **Zakelijke giften en sponsoring.**
   - Rol: Business Pass-lid, zakelijk.
   - Proces: sponsoring met factuur (bestaat in het voornemen) → afspraak over de tegenprestatie → factuur uit de fiscale laag (`kern/fiscaal/tarief.js` voor btw).
   - Nodig: **eigenaarsbesluit** over btw op sponsoring; de klasse is **advies** tot een mens het beoordeelt.
8. **Verantwoording per gift voor de gever (impactrapport).**
   - Rol: projectleider van de stad.
   - Proces: besteding boeken → bewijsstuk → de gever ziet het op projectniveau (GV-15).
   - Nodig: geen nieuw genre; de regel "nooit op mensniveau" blijft.

Huisregels die ook in B gelden: geen thermometer, geen ranglijst, geen badge voor gevers; het geld beweegt alleen na een bevestiging door de gever; aftrekbaarheid alleen als feit wanneer de beschikking er is; een kind geeft niet via een gezinssessie.

### Ketens LOS en SAMEN

**LOS.** Met Klimaatfonds, Winkel en het donateursportaal uit blijft de kerntaak intact: de stand lezen, een voornemen zien, eenmalig of periodiek geven en een machtiging tekenen of intrekken. RTG Pay kan niet uit zonder dat de kern stilvalt. Dan zegt het scherm de 503-zin: "RTG Pay is nu niet bereikbaar. Er is niets afgeschreven; probeer het straks opnieuw." Staat de stand dicht, dan zegt het scherm de reden en toont het geen knop.

**SAMEN — keten "periodieke gift voor een klimaatproject":**
1. Het lid ziet een duurzaamheidsproject in het Klimaatfonds (`gemeenschap.klimaatfonds`).
2. Het lid tikt op "Hieraan geven" en Geven opent met het project (`geven.doneren`).
3. Het lid ziet het voornemen en bevestigt een eerste gift; RTG Pay boekt (`betalen.rtgpay`).
4. Het lid stelt een plan van vijf jaar voor (Geven).
5. Het kantoor legt de overeenkomst vast (`kantoor.rtfbeheer`, GV-10).
6. Het lid tekent een machtiging (Geven).
7. Het lid ziet de gift in "mijn giften" en het jaaroverzicht (GV-07).
8. Het lid neemt het jaaroverzicht mee naar de aangifte (`overheid.rijk-burger`, verwijzing).

Storingen:
- **Het project stopt tussen stap 2 en 3:** de server weigert het oormerk ("Kies een project dat nu loopt"); er wordt niets afgeschreven.
- **RTG Pay valt uit bij stap 3:** 503 en niets afgeschreven; dezelfde sleutel bij een nieuwe poging geeft één gift.
- **De bronregistratie mislukt na de boeking:** het antwoord zegt "je gift is afgeschreven, maar de registratie bij de stichting is niet gelukt … het geld is niet weg".
- **Het kantoor legt niet vast (stap 5):** het plan blijft `voorgesteld` met de zin dat elke betaling tot dan een gewone gift is.
- **Geen incasso-rail (stap 6):** de machtiging staat er met `geindNu: false` en de reden; elke termijn bevestigt de gever zelf.
- **De Overheid-app is uit (stap 8):** het jaaroverzicht blijft in Geven leesbaar; alleen de doorverwijzing ontbreekt.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | eenmalig, geoormerkt, periodiek, machtiging, jaaroverzicht en verantwoording op projectniveau zijn er alle zes, of staan als besluit genoemd | functiecatalogus tegen de code; tabel b zonder onverklaarde "nee" |
| professionele diepte | de periodieke overeenkomst bevat alle elementen uit de modelovereenkomst van de Belastingdienst (looptijd, vast bedrag, partner, eindigingsgronden) | toets op GV-08 en GV-17; een juridische controle door een mens, vastgelegd |
| levenscyclus | elk plan eindigt in `afgelopen`, `gestopt` of `beëindigd`, zonder open termijnen of vervallen machtigingen | voltooiproef uitgebreid met het einde van de looptijd |
| samenwerking en rollen | de gever tekent, het kantoor legt vast, de boardroom zet de stand en het bestuur beoordeelt de herkomst, en geen rol kan de handeling van een andere doen | BEVOEGD-kruisparen; IDOR-meting met een bereikbare id (vandaag 10 "onbereikbaar") |
| domeinintelligentie | elke fiscale zin hoort bij een van de vier klassen en geen zin belooft aftrekbaarheid buiten de stand `ja` | toets op `anbiZin` voor alle vier de standen; grep op "aftrekbaar" in schermteksten |
| los functioneren | met Klimaatfonds, Winkel en portaal uit werken voornemen en bevestigen volledig | voltooiproef met de koppelingen uit |
| RTG-ketens | de keten "periodieke gift voor een klimaatproject" sluit van 1 tot 8, met elke storing zoals beschreven | ketenproef Klimaatfonds → Geven → Pay → kantoor; uitvaltoets per schakel |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen op BEWEZEN in het centrale register | `APPWERKT.json` na hermeting met de scenario's; `IDOR.json` zonder "onbereikbaar" |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar volgens SCHERMEIGENAAR.json | geen dubbele logica: wat Geven alleen verwijst |
|---|---|---|
| saldo, opladen, transacties | `apps/pay.html`, `betalen.rtgpay`; `apps/geld.html`, `geld.overzicht` (`apps/wallet.html` is een alias naar `/apps/geld.html#wallet`) | Geven roept `pay.partnerIn` aan en toont geen saldo-logica |
| donateursoverzicht op code | `apps/foundation/os-donateur.html`, `gift.overzicht` | Geven verwijst; het giftbewijs blijft daar (`donateur.js: bewijs`) |
| aangifte, aftrekberekening | `apps/overheid.html`, `overheid.rijk-burger` | alleen het jaaroverzicht (GV-07) als verwijzing; geen drempelberekening in Geven |
| nalatenschap | `link:nalatenschap` → `/apps/geld.html#nalatenschap` (onder `geld.overzicht`) | alleen een verwijzing |
| giftstand zetten, plannen vastleggen | `apps/foundation/kantoor.html`, `kantoor.rtfbeheer` | Geven leest de stand; zetten staat daar |
| herkomst van grote giften | `apps/foundation/os-bestuur.html`, `kantoor.governance` | Geven zegt alleen vooraf dat er wordt beoordeeld; het oordeel staat daar (tab "Grote giften") |
| iets kopen | `apps/foundation/winkel.html`, `rtf.winkel` | Geven verwijst en zegt dat een aankoop geen gift is |
| projectkeuze vanuit het klimaat | `apps/foundation/klimaatfonds.html`, `gemeenschap.klimaatfonds` | alleen de project-id |
| labfonds (toezeggingen voor het onderzoekslab) | `apps/labfonds.html` is een alias naar `/apps/geld.html#labfonds` | twijfel: aan de integrator voorleggen of een gift aan het lab via Geven of via het labfonds loopt; het labfonds is een toezegging in een eigen grootboek (`kern/labfonds.js`) en geen RTG Pay-gift |


---

## 3. Klimaatfonds — `link:klimaat`, `/apps/foundation/klimaatfonds.html`

Het Klimaatfonds is het klimaatvenster op het Living Lab van de RTFoundation. Een bewoner met een account kiest zijn stad, stelt een vraag over duurzaamheid, steunt de vraag van een ander, ziet welk onderzoek er loopt en welke duurzaamheidsprojecten er zijn, en kan via Geven een gift aan zo'n project vastzetten (SCHERMEIGENAAR.json: `gemeenschap.klimaatfonds`, rol eigenaar, doelgroep `lid`). De kern is dat dit **geen tweede lab en geen tweede boekhouding** is: klimaat is een soort (`duurzaam`) in `server/kern/livinglab/kader.js` en in `server/kern/rtfos/projecten.js`. Het geld van het onderzoek staat in het labfonds (`/apps/geld.html#labfonds`) en de gift loopt via Geven. Het scherm zegt dat zelf ("dan stonden er twee boekhoudingen naast elkaar").

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | 3 stappen gesloten (afgeleid) | |
| voltooibaar | GEEN_FIXTURE | 8 stappen gesloten | project in beide lijsten; lab en onderzoek zichtbaar; vraag stellen; steunen (tweede keer 409); 4 bevoegdheidsstappen (projecten zonder account, vraag/stem zonder account, andere alias zelfde account, kind) |
| waarheidsgetrouw | BEWEZEN | — | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | |
| bevoegd | BEWEZEN | — | BEVOEGD.json 1/1 |
| herstelbaar | GEEN_FIXTURE | 4 stappen gesloten | dubbele tik vraag, dubbele tik steun, afgebroken vraag, crash na stem |
| IDOR | — | — | lab2 niet gemeten |

Bron: `scripts/lib/voltooi/klimaat.js`. De grens die de proef zelf noemt: Geven zelf loopt in `geven.js`, en het Living Lab en het onderzoek maakt de eigenaar langs het kantoor.

Wat de code doet (gelezen):
- **Scherm** (`public/apps/foundation/klimaatfonds.html`): stadkeuze via `/api/lab2/bewoner/labs`; vragen via `/api/lab2/bewoner/themas`, gefilterd op `SOORT = 'duurzaam'` (één soort; mobiliteit en leefomgeving worden bewust niet bijgeteld); steunen via `/stem`; een vraag stellen via `/thema` met een herhaalsleutel; onderzoek via `/overzicht` met een stappenbalk en het aantal per soort van de server ("een gescheiden studie telt wel mee en staat niet in de lijst"). Projecten komen uit `/api/rtfos/gift/projecten` met `soort: duurzaam` en een knop "Hieraan geven" naar `geven.html?project=<id>`. Er zijn links naar het labfonds en het hele Living Lab.
- **Bewonersdeuren** (`server/routes/livinglab/bewoner.js`, `bewoneraccount.js`, `bewonerpas.js`, `openbaar.js`): sinds het eigenaarsbesluit van 19 oktober 2026 vraagt elke deur een account (een gratis account is genoeg) of een gezinsprofiel onder een ouderaccount. De stem hangt aan een **stemmerhash** van het account (`'st:' + sha256('lab2-stem|' + wie)`), niet aan de alias. De remmen: schrijven 10 per minuut, lezen 60 per minuut, codedeuren 20 per bron en 60 per code. Het labpaspoort (punten, niveaus, badges) loopt door `progressieMag` en geeft onder de grens 403. De klacht vraagt ook een account.
- **Thema's** (`server/kern/livinglab/themas.js`): vraag 10–300 tekens; herhaalsleutel; maximaal 5.000 per lab; de teller hangt aan het thema; `themaKoppel` legt de herkomst vast in beide richtingen (thema ↔ studie, met "Dit onderzoek komt uit een vraag van de buurt (n stemmen)").
- **Vraagbesluit** (`server/kern/livinglab/vraagbesluit.js`): standen `ingediend`, `verkend`, `beoordeeld`, `gestart` en `niet-gestart`; een gesloten lijst redenen (`bestaat-al`, `niet-te-scheiden`, `niet-proportioneel`, `geen-lab-vraag`, `buiten-bereik`, `te-weinig-draagvlak`); een vraag wordt nooit verwijderd. Openbaar via `/api/lab2/publiek/vragen`. **Het Klimaatfonds roept die route niet aan**: een bewoner ziet hier zijn vraag met stemmen, maar niet het antwoord of de reden.
- **Impact** (`server/kern/livinglab/impact.js`): gestopte studies tellen als opbrengst, herziene conclusies tellen mee, uitgevoerd staat apart van ingediend, en "promoveert nooit een indicatie tot een effect". Wordt niet in het Klimaatfonds getoond.
- **Uitleen** (`server/kern/livinglab/uitleen.js`, `apparatuur.js`): catalogus met kalibratiestand en storing; standen `aangevraagd` → `toegekend`/`afgewezen` → `meegegeven` → `terug` → `afgerond`; openbaar via `/api/lab2/publiek/apparatuur` en `/uitleen-aanvraag`. Niet zichtbaar in het Klimaatfonds.
- **Projecten** (`server/kern/rtfos/projecten.js`): `duurzaam` → module `city_projects`; publiek alleen naam, soort en doelgroep, zonder bedragen (`publiek.js`).
- **Labfonds** (`server/kern/labfonds.js`, routes `server/routes/labfonds.js`): leden doen toezeggingen per locatie, maken voorstellen en stemmen; een AI-"scheidsrechter" adviseert over eerlijkheid en privaat gewin en "breekt gelijke stand". Het geld is een toezegging in het fondsgrootboek, en de module claimt nooit dat een betaling verwerkt is.
- **Verouderde schermtekst:** het commentaar en de melding in `klimaatfonds.html` zeggen nog dat er "een stem per alias" telt en vragen een alias "zodat er per persoon één telt". Sinds `bewoneraccount.js` telt de stem per account en is de alias hooguit een weergavenaam. Zie KF-03.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Decidim (Budgets) | open source; geen pakketten gevonden | geen gegevens | stemregels (vast aantal projecten of tot een bedrag), resultaten publiceren, gekozen projecten markeren, Accountability-component voor de voortgang van de uitvoering | Decidim docs — https://docs.decidim.org/en/develop/admin/components/budgets.html (zoekresultaat 2026-10-19, pagina niet geopend); Decidim docs — https://docs.decidim.org/en/admin/components/budgets (zoekresultaat 2026-10-19, pagina niet geopend) |
| Go Vocal (voorheen CitizenLab) | jaarabonnement voor overheden | geen gegevens | burgerbegroting met geschatte kosten per voorstel, online en papieren stemmen | Go Vocal — https://www.govocal.com/platform-features/participatory-budgeting (zoekresultaat 2026-10-19, pagina niet geopend) |
| Ecosia | gratis voor de gebruiker | geen gegevens | zoekmachine die opbrengst naar klimaatprojecten brengt | Ecosia — https://www.ecosia.org/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Energiecoöperatie onder de SCE | lidmaatschap en participatie | geen gegevens over ledenprijs; de SCE is een exploitatiesubsidie per kWh voor 15 jaar, alleen voor nieuwe installaties | lid zijn, participeren in een installatie, wonen of gevestigd zijn in de postcoderoos | RVO — https://www.rvo.nl/subsidies-financiering/sce (zoekresultaat 2026-10-19, pagina niet geopend); HIER opgewekt voorbeeldovereenkomst — https://www.hier.nu/uploads/hieropgewekt/inline/Voorbeeld%20deelnemersovereenkomst%20SCE_0.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |
| Gemeentelijk buurtbudget | per gemeente | Lelystad: tot € 2.500 per inwonersinitiatief; Venlo Klingerberg: € 140.000 voor de wijk | onderbouwd idee + aantoonbaar draagvlak; bewoners voeren uit | Windesheim gemeenteprofiel Lelystad — https://www.windesheim.nl/getmedia/1aa5e29a-b514-4070-b168-7d8e326c1843/Gemeenteprofiel-Lelystad.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Venlo raadsvragen — https://gemeenteraad.venlo.nl/Documenten/Art-44-vragen-VSP-Uitvoering-initiatieven-buurtbudget-Klingerberg.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| ideeën of vragen indienen | ja |
| steunen (één per persoon) | ja (per account) |
| antwoord op een ingediende vraag, met reden | half: bestaat in het lab, niet in dit venster |
| begrotingsstemming met bedragen | half: het labfonds kent voorstellen en stemmen per locatie, het Klimaatfonds verwijst |
| voortgang van gekozen projecten volgen (Accountability) | half: projecten met naam en soort; geen voortgang of besteding publiek |
| geld geven aan een project | ja (via Geven) |
| onderzoek met bewijsgraad | ja in het lab; niet getoond in het venster |
| meetapparatuur lenen | ja in het lab; niet getoond in het venster |
| deelnemen in een energie-installatie | nee (zie KF-N4) |

### c. Het volledige domein

**Particulier.** Bewoners werken aan het klimaat in hun wijk via energiecoöperaties, buurtinitiatieven (groen, regenwater, zonnepanelen op een school), de wijkaanpak voor aardgasvrij wonen en metingen in eigen huis. De zoekresultaten over het Programma Aardgasvrije Wijken noemen proeftuinen in 46 gemeenten. Volgens die resultaten scoren proeftuinen met een actief bewonersinitiatief hoger op tevredenheid, kost het betrekken van bewoners meer tijd dan verwacht, en werkt persoonlijk, kleinschalig contact beter dan grote avonden (PBL — https://www.pbl.nl/publicaties/warmtetransitie-in-de-praktijk (zoekresultaat 2026-10-19, pagina niet geopend); Gemeente.nu — https://gemeente.nu/ruimte-milieu/aardgasvrije-wijken-de-lessen-tot-nu-toe (zoekresultaat 2026-10-19, pagina niet geopend)). Een aanbevelingsdocument zegt dat een besluit over het gasnet top-down en democratisch moet blijven, en dat bewonersinitiatieven zonder samenwerking met de gemeente weinig kans maken (HIER — https://www.hier.nu/uploads/hieropgewekt/inline/Aanbevelingen%20bewonersparticipatie%20in%20Transitievisie%20Warmte_1.pdf (zoekresultaat 2026-10-19, pagina niet geopend)).

**Professioneel.** Er werken energiecoaches, installateurs, onderzoekers en projectleiders van coöperaties. In het genre-register staat `bouw` (Bouw & installatie), zonder persoonseis; er is geen genre voor energieadvies. RTG belooft dus geen vakbekwaamheid. Het onderzoek zelf heeft de rollen en de ethiek van het Living Lab (`kader.js: ROLLEN`, `ethiek.js`).

**Organisatorisch.** Een energiecoöperatie werkt sinds 2021 met de SCE (opvolger van de postcoderoosregeling; volgens het zoekresultaat liep de regeling tot 1 april 2026 met een voorgestelde verlenging tot uiterlijk 2031, waarvan de vaststelling niet bevestigd is). Deelnemers moeten lid zijn, een deelnemersovereenkomst tekenen, in de postcoderoos wonen en een kleinverbruikersaansluiting hebben (zie de voorbeeldovereenkomst hierboven). Gemeenten werken met buurtbudgetten: een onderbouwd idee met aantoonbaar draagvlak, en soms leges die het budget verkleinen (Venlo). De stichting heeft haar eigen projecten per stad, het labfonds per locatie en het onderzoeksgrootboek (`ledger.js`: "de studie is de kostenplaats, het lab is de betaler").

**Regels.**
- AVG/UAVG bij metingen in huis (energiegebruik is persoonsgegeven).
- Onderzoeksethiek: toestemming, terugtrekken met eerst het gevolg (`terugtrekken.js`) en de klacht (`ethiek.js`).
- Alleen geaggregeerd naar gemeenten (LEVEN 2.6).
- De SCE en de postcoderoos zijn regelingen voor de coöperatie, niet voor de app.

**Wat daaruit volgt voor de app.** Het venster mist de **teruggekoppelde trechter**: de bewoner ziet zijn vraag, maar niet wat ermee gebeurde (KF-06) en niet de weg van vraag naar onderzoek, project, gift en besteding (KF-14). "Geen lab-vraag" hoort een uitweg te hebben naar democratie of gemeente (KF-16). En wat het lab al heeft (bewijsgraad, impact, uitleen) staat niet in het venster, terwijl dat precies is wat dit huis onderscheidt van een ideeënbus.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** vraag, steun, onderzoek en project bestaan; het antwoord op de eigen vraag ontbreekt.
- **L2 Professioneel via bestaande genres:** er is geen genre voor energieadvies; professioneel werk loopt via de rollen van het lab en de uitleen van gekalibreerde apparatuur.
- **L3 Organisatorisch:** de keten van vraag naar project bestaat niet. `themaKoppel` gaat alleen naar een studie, en het labfonds staat los.
- **L4 Domeinintelligentie:** bewijsgraden en impact bestaan en zijn streng; het venster laat ze niet zien.
- **L5 Volledige levenscyclus:** te volgen van vraag tot besteding, met projectie op ids; vandaag stopt het zicht bij "er loopt onderzoek".
- **L6 RTG-samenhang:** Geven werkt; Kwesties, Gemeente en Wonen zijn verwijzingen die ontbreken.

**KF-01 Stad en lab kiezen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/api/lab2/bewoner/labs` (alleen actieve labs, zonder budget, tekenaars of partners).
- Regels en rekenwijze: een account of gezinsprofiel; remmen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: bewoner met een account.
- Uitzonderingen: zonder account 401 met de zin "een gratis account is genoeg".
- Acceptatiecriterium: Gegeven een actief Living Lab in Zwolle, wanneer een lid het Klimaatfonds opent, dan staat Zwolle in de keuze en zijn budget en tekenaars niet (voltooiproef: gesloten).

**KF-02 Een duurzaamheidsvraag stellen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `themas.js: themaBij` met `soort: duurzaam`.
- Regels en rekenwijze: 10–300 tekens; herhaalsleutel; nooit verwijderd.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de vraag staat in het lab; niemand krijgt een bericht.
- Rollen en toestemming: account of gezinsprofiel.
- Uitzonderingen: dezelfde sleutel met een andere tekst geeft 409.
- Acceptatiecriterium: Gegeven een lid, wanneer hij twee keer tikt op Stuur met dezelfde sleutel, dan staat de vraag er één keer (voltooiproef: gesloten).

**KF-03 Steunen: één stem per account** · L1 · bestaat (schermtekst verouderd) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `themaStem(b, stemmer)` met de stemmerhash uit `bewoneraccount.js`.
- Regels en rekenwijze: een tweede stem van hetzelfde account geeft 409, met welke alias ook. De lijst staat op stemmen gesorteerd, maar een stem beslist niets (`vraagbesluit.js`: "geen ranglijst van vragen … ze beslissen niet").
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: account of gezinsprofiel.
- Uitzonderingen: het scherm vraagt nog een alias "zodat er per persoon één telt". Dat is niet meer waar, en de zin en het verplichte aliasveld horen weg.
- Acceptatiecriterium: Gegeven een lid zonder ingestelde alias, wanneer hij een vraag steunt, dan telt de stem zonder dat het scherm om een alias vraagt, en een tweede stem onder een andere alias geeft 409 (het laatste: voltooiproef gesloten).

**KF-04 Zien welk onderzoek er loopt** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/api/lab2/bewoner/overzicht` (de buitenste ring).
- Regels en rekenwijze: een gescheiden studie toont alleen titel en stap; het aantal per soort komt van de server.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: account.
- Uitzonderingen: geen onderzoek → "Hier loopt nog geen onderzoek over duurzaamheid."
- Acceptatiecriterium: Gegeven een studie `duurzaam` in stap vraagstuk, wanneer het lid kijkt, dan ziet hij de titel en de stap (voltooiproef: gesloten).

**KF-05 Duurzaamheidsprojecten zien en eraan geven** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `gift-projecten.js: lijst({soort: 'duurzaam'})`.
- Regels en rekenwijze: alleen actieve projecten; de knop opent Geven met de id.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: een eigen account (het kind komt er niet in: voltooiproef).
- Uitzonderingen: giftstand dicht → Geven zegt waarom.
- Acceptatiecriterium: Gegeven een actief project "Zonnedaken", wanneer het lid op "Hieraan geven" tikt, dan opent Geven met dat project en staat dezelfde id in beide lijsten.

**KF-06 Het antwoord op mijn vraag zien (stand en reden)** · L1 · half (bestaat in `vraagbesluit.js` en `/api/lab2/publiek/vragen`; het venster roept het niet aan) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `vraagbesluit.publiek(t)`: stand, studie-id, besluit met reden, naam en toelichting.
- Regels en rekenwijze: de reden komt uit de gesloten lijst; "heroverweeg" bestaat. Het venster leest dezelfde route en schrijft geen eigen standen.
- Onzekerheid: geen; een besluit is een besluit van een mens met een reden.
- Wie hoort wat, wanneer: iedereen met een account ziet de stand; de vraagsteller ziet hem bij zijn volgende bezoek, zonder push.
- Rollen en toestemming: het lab beslist (tekenbevoegde).
- Uitzonderingen: geen besluit → stand `ingediend`.
- Acceptatiecriterium: Gegeven een vraag die het lab op `niet-gestart` zette met reden `bestaat-al`, wanneer het lid het Klimaatfonds opent, dan ziet hij bij die vraag "Er bestaat al onderzoek naar" met de toelichting.

**KF-07 Meetapparatuur lenen vanuit het venster** · L2 · half (uitleen bestaat in het lab, het venster verwijst niet) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/api/lab2/publiek/apparatuur` (catalogus met kalibratie en storing) en `/uitleen-aanvraag`.
- Regels en rekenwijze: alleen een verwijzing of een filter op apparaten die bij `duurzaam` horen (bijvoorbeeld een energiemeter). Welke soorten dat zijn, staat in `apparatuur.js: SOORTEN` (niet uitgelezen). Toekennen doet het lab.
- Onzekerheid: een apparaat met verlopen kalibratie meet niet betrouwbaar; de catalogus zegt dat.
- Wie hoort wat, wanneer: de aanvrager ziet de stand van zijn aanvraag.
- Rollen en toestemming: bewoner vraagt aan, lab kent toe.
- Uitzonderingen: geen apparaat → geen blok.
- Acceptatiecriterium: Gegeven een gekalibreerd apparaat in het lab van Zwolle, wanneer het lid het Klimaatfonds opent, dan ziet hij het met de kalibratiestand en kan hij een aanvraag doen die in het lab als `aangevraagd` staat.

**KF-08 Van gesteunde vraag naar projectvoorstel bij de stad** · L3 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: een verwijzing van thema-id naar project-id, naast de bestaande `themaKoppel` (thema → studie). Het project ontstaat langs `projecten.js` met de vierogen van het kantoor.
- Regels en rekenwijze: alleen een medewerker zet de koppeling, met reden. Het thema houdt de herkomst vast, zoals bij een studie. Een project in de aanvraagfase is niet publiek (`publiek.js`), dus de bewoner ziet "in behandeling" en geen projectnaam tot het project actief is.
- Onzekerheid: draagvlak is geen besluit.
- Wie hoort wat, wanneer: de vraagsteller en de stemmers zien de stand.
- Rollen en toestemming: het RTF-kantoor van de stad.
- Uitzonderingen: de module `city_projects` staat uit → de koppeling wordt geweigerd met reden.
- Acceptatiecriterium: Gegeven een vraag met 30 stemmen, wanneer het kantoor er een project aan koppelt dat actief wordt, dan toont de vraag "werd project [naam]" en het project "kwam uit een vraag van de buurt (30 stemmen)".

**KF-09 Labfonds-voorstel per locatie (verwijzing)** · L3 · bestaat (in Geld#labfonds) · kosten klein · complexiteit laag · aanbevolen nu (alleen verwijzing)
- Gegevens en bron: `kern/labfonds.js` (toezeggingen, voorstellen, stemmen, besluit).
- Regels en rekenwijze: het Klimaatfonds bouwt geen eigen stemming; het verwijst met de lab- of locatie-id. Twijfel: de AI-scheidsrechter "breekt gelijke stand". Of dat strookt met "bevestigen doet de mens", leg ik aan de integrator voor.
- Onzekerheid: een toezegging is geen betaling (kop `labfonds.js`).
- Wie hoort wat, wanneer: leden van de locatie.
- Rollen en toestemming: lid met een account.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een locatie Zwolle in het labfonds, wanneer het lid op "Bekijk het labfonds" tikt, dan opent `geld.html#labfonds` op Zwolle en staat er in het Klimaatfonds geen bedrag.

**KF-10 Energiecoöperatie of buurtinitiatief als partner** · L3 · half (partners en het organisatieportaal bestaan) · kosten middel · complexiteit midden · later
- Gegevens en bron: `kern/rtfos/partners.js`; `os-portaal.html` (`portaal.toegang`).
- Regels en rekenwijze: een coöperatie registreert zich als partner; een project kan een `partnerId` dragen (het veld bestaat in `projecten.js`). Het venster toont alleen de partnernaam bij een actief project.
- Onzekerheid: RTG keurt de coöperatie niet inhoudelijk.
- Wie hoort wat, wanneer: de partner ziet zijn eigen dossier.
- Rollen en toestemming: partner met een code; het kantoor koppelt.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een actief project met een partner-coöperatie, wanneer het lid het project ziet, dan staat de naam van de coöperatie erbij en geen contactpersoon.

**KF-11 Bewijsgraad bij een afgerond onderzoek tonen** · L4 · half (het lab kent bewijsgraden; het venster toont ze niet) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de publicatielaag (`/api/lab2/publiek/onderzoek(en)`, `publicatie.js`) en `bewijs.js`.
- Regels en rekenwijze: de conclusie staat met haar graad; een indicatie heet nooit een effect.
- Onzekerheid: de graad is precies de onzekerheid, en die wordt getoond.
- Wie hoort wat, wanneer: iedereen met een account.
- Rollen en toestemming: geen.
- Uitzonderingen: een gescheiden studie toont geen conclusie.
- Acceptatiecriterium: Gegeven een afgeronde studie met een conclusie van graad "indicatie", wanneer het lid hem in het Klimaatfonds bekijkt, dan staat het woord "indicatie" erbij en nergens "bewezen effect".

**KF-12 Impact van het lab, eerlijk geteld** · L4 · half (kern bestaat) · kosten klein · complexiteit laag · later
- Gegevens en bron: `impact.js: impact(labId)` en `opbrengst`.
- Regels en rekenwijze: gestopt telt als opbrengst; herzien telt mee; uitgevoerd apart van ingediend. Geen "35 projecten uitgevoerd" als drukte.
- Onzekerheid: "niet gemeten" is geen nul.
- Wie hoort wat, wanneer: iedereen met een account.
- Rollen en toestemming: geen.
- Uitzonderingen: een lab zonder afgeronde studies → "nog niets afgerond", geen 0%.
- Acceptatiecriterium: Gegeven een lab met één gestopte en één afgeronde studie, wanneer het lid de impact opent, dan staat het stoppercentage erbij en wordt de gestopte studie niet als verlies getoond.

**KF-13 Besparingsschatting voor het eigen huis** · L4 · ontbreekt · niet doen (in deze app)
- Reden: het vraagt woningdata (gebruik, installatie), en die hoort bij `apps/wonen.html` (`woning.overzicht`). Een schatting is een voorspelling en geen feit, en een tweede woningmodel hier zou dubbele logica zijn.

**KF-14 Volg mijn vraag van begin tot besteding** · L5 · half · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: een projectie op ids: thema → (vraagbesluit) → studie (`themaKoppel`) → project (KF-08) → giften op project (bronnen, alleen geaggregeerd) → besteding (alleen op projectniveau).
- Regels en rekenwijze: er wordt niets gekopieerd; elke stap leest zijn eigen eigenaar. Bedragen van giften op het project zijn niet publiek (`publiek.js`), dus hier staat alleen "er wordt aan gegeven" of niets.
- Onzekerheid: elke schakel kan ontbreken; dan staat er "nog niet" en geen gat.
- Wie hoort wat, wanneer: de vraagsteller, als hij kijkt.
- Rollen en toestemming: account.
- Uitzonderingen: een gescheiden studie → alleen titel en stap.
- Acceptatiecriterium: Gegeven een vraag die tot een studie leidde, wanneer de vraagsteller hem opent, dan ziet hij de keten "vraag → onderzoek [titel, stap]", en zonder project staat er "nog geen project", geen leeg vak.

**KF-15 Meedoen aan een onderzoek (labpas, terugtrekken)** · L5 · bestaat (in het Living Lab) · kosten klein · complexiteit laag · aanbevolen nu (alleen verwijzing)
- Gegevens en bron: `/api/lab2/mijn*` met de labpas; `terugtrekken/gevolg` eerst, dan `terugtrekken`.
- Regels en rekenwijze: het account is de deur en de pas de rol. De labpas wordt bewust niet aan het account gekoppeld.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de deelnemer.
- Rollen en toestemming: deelnemer met een labpas.
- Uitzonderingen: het labpaspoort (progressie) alleen voor 18+ via `progressieMag`.
- Acceptatiecriterium: Gegeven een lid met een labpas, wanneer hij vanuit het Klimaatfonds naar "doe mee" gaat, dan opent `livinglab.html` en wordt er in het Klimaatfonds niets van de pas bewaard.

**KF-16 "Geen lab-vraag" doorgeven naar Kwesties of de gemeente** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: een vraag met reden `geen-lab-vraag` ("we geven hem door in plaats van er een studie van te maken") of `buiten-bereik`. De doorgifte is een verwijzing met de thema-id.
- Regels en rekenwijze: het venster zet een kwestie klaar in `apps/foundation/kwesties.html` (`democratie.kwestie`), of een melding in `apps/gemeente.html` (`overheid.gemeente-burger`), met de tekst van de vraag. De bewoner bevestigt, want het bereikt een instantie: één menselijke bevestiging.
- Onzekerheid: of de instantie iets doet, ligt buiten RTG.
- Wie hoort wat, wanneer: alleen de vraagsteller beslist. De stemmers zien "doorgegeven aan Kwesties" als hij dat doet.
- Rollen en toestemming: de vraagsteller; het lab geeft de reden.
- Uitzonderingen: met Kwesties uit staat de knop er niet en zegt het venster waar de vraag wel heen kan.
- Acceptatiecriterium: Gegeven een vraag met reden `geen-lab-vraag`, wanneer de vraagsteller "breng in als kwestie" bevestigt, dan ontstaat er één kwestie met een verwijzing naar de thema-id, en zonder bevestiging ontstaat er niets.

**KF-17 Geaggregeerd beeld naar de gemeente** · L6 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: het aantal duurzaamheidsvragen per stad per kwartaal, de verdeling per vraagbesluit-stand en de actieve projecten.
- Regels en rekenwijze: alleen geaggregeerd met een k-drempel (LEVEN 2.6; `gemeente.js`); nooit per straat.
- Onzekerheid: onder de drempel "niet gemeten".
- Wie hoort wat, wanneer: de gemeente via het portaal.
- Rollen en toestemming: `portaal.toegang`.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven drie vragen in een kwartaal en een k-drempel van vijf, wanneer de gemeente het beeld opvraagt, dan ziet zij "niet gemeten".

**KF-N1 Klimaatscore, CO2-ranglijst of "klimaatheld"-badges per huishouden of buurt** · niet doen — een score op een mens, en progressie onder 18 is verboden; ook boven 18 hoort een vergelijking van huishoudens niet in een buurtvenster.

**KF-N2 Een eigen klimaatlab of een eigen klimaatbegroting** · niet doen — dat dupliceert het Living Lab en het labfonds (PLATFORM.md, volgens de kop van het scherm).

**KF-N3 CO2-compensatie verkopen** · niet doen (nieuw domein vóór V1) — handel in claims die RTG niet kan verifiëren.

**KF-N4 Deelnemen in een energie-installatie of collectieve inkoop** · niet doen (nieuw domein vóór V1) — het vraagt coöperatie-lidmaatschap, een SCE-aanvraag en een postcoderoostoets buiten de app.

### e. RTG-exclusief

1. **De teruggekoppelde trechter.** Klimaatfonds (vraag, eigenaar `gemeenschap.klimaatfonds`) → Living Lab (vraagbesluit en studie, eigenaar `onderzoek.lab`) → RTF-stad (project, `kantoor.rtfbeheer`) → Geven (gift, `geven.doneren`) → donateursportaal (besteding op projectniveau, `gift.overzicht`). Elke schakel houdt de id van de vorige vast; niemand neemt data over. Decidim en buurtbudgetten hebben stemming en uitvoering, maar geen onderzoek met bewijsgraad tussen vraag en geld.
2. **"Nee" is ook een antwoord, en het heeft een uitweg.** Living Lab (`geen-lab-vraag`) → Kwesties (`democratie.kwestie`) of Gemeente (`overheid.gemeente-burger`), met één bevestiging van de bewoner.
3. **Meten met gekalibreerde apparatuur van de stichting.** Klimaatfonds → Living Lab-uitleen (kalibratie, storing) → studie (meting met toestemmingsgrond, `instrument.js`). Wat er gemeten wordt, valt onder de ethieklaag, niet onder een app van derden (kop van `bewoner.js`).
4. **Een stem die aan een mens hangt zonder hem bloot te geven.** De stemmerhash van het account: één stem per persoon, en het onderzoeksdossier wijst niet terug naar het lid.

### f. Bouwstenen en ontbrekende koppelingen

Wat er staat: `public/apps/foundation/klimaatfonds.html`, `server/routes/livinglab/bewoner.js`, `bewoneraccount.js`, `bewonerpas.js`, `openbaar.js`, `server/kern/livinglab/themas.js`, `vraagbesluit.js`, `studie.js`, `impact.js`, `uitleen.js`, `apparatuur.js`, `publicatie.js`, `bewijs.js`, `kader.js`, `ledger.js`, `server/kern/rtfos/projecten.js`, `gift-projecten.js`, `publiek.js`, `server/kern/labfonds.js`, `scripts/lib/voltooi/klimaat.js`.

| koppeling | van → naar | vorm | stand |
|---|---|---|---|
| antwoord op de vraag | Living Lab (`vraagbesluit`) → Klimaatfonds | projectie (bestaande route) | ontbreekt in het venster |
| thema → project | Living Lab-thema → RTF-project | verwijzing (id in beide) | ontbreekt |
| volg mijn vraag | Klimaatfonds → lab, project en bron | projectie op ids | ontbreekt |
| uitleen | Living Lab → Klimaatfonds | projectie (bestaande route) | ontbreekt in het venster |
| bewijsgraad en impact | Living Lab → Klimaatfonds | projectie | ontbreekt in het venster |
| geen-lab-vraag → kwestie | Klimaatfonds → Kwesties | verwijzing (thema-id) | ontbreekt |
| projectgift | Klimaatfonds → Geven | id in de URL | bestaat |
| labfonds | Klimaatfonds → Geld#labfonds | link | bestaat (zonder locatie-id) |
| levensgraaf | Klimaatfonds → `server/kern/levensgraaf/graaf.js` | projectie (eigen vraag als knoop) | niet nagekeken |
| IDOR-meting lab2 | — | meting | niet gemeten |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| KF-06 antwoord op mijn vraag | nu | klein | laag | — (bestaande route) |
| KF-03 aliasveld en schermtekst rechtzetten | nu | klein | laag | — |
| KF-14 volg mijn vraag | nu | middel | midden | KF-06; KF-08 voor de projectschakel |
| KF-16 doorgeven naar Kwesties of gemeente | nu | klein | midden | Kwesties (`democratie.kwestie`) |
| KF-11 bewijsgraad tonen | nu | klein | laag | publicatielaag |
| KF-07 uitleen in het venster | nu | klein | laag | soorten in `apparatuur.js` |
| KF-09 labfonds met locatie-id | nu | klein | laag | twijfel over de AI-scheidsrechter (integrator) |
| KF-08 thema → project | later | middel | midden | eigenaarsbesluit (een nieuwe verwijzing in `projecten.js`) |
| KF-10 coöperatie als partner | later | middel | midden | partnerportaal |
| KF-12 impact | later | klein | laag | — |
| KF-17 geaggregeerd naar de gemeente | later | klein | laag | `gemeente.js` k-drempel |
| IDOR-meting lab2 | nu | klein | laag | meetscript |
| KF-13, KF-N1 t/m N4 | niet doen | — | — | — |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **KF-06 + KF-03 + KF-11 + KF-07 + KF-16 + KF-14** (de versie zonder projectschakel) **+ KF-09**, plus de IDOR-meting op lab2. Alles bestaat al in het Living Lab en in Kwesties; het venster gaat het lezen en ernaar verwijzen. Er komt geen motor, laag of tweede lab bij.

Wat de gebruiker daarna kan wat hij nu niet kan:
- De **vraagsteller** ziet wat er met zijn vraag gebeurde ("niet gestart: er bestaat al onderzoek naar") en volgt hem tot het onderzoek.
- Bij **"hier helpt onderzoek niet"** brengt hij zijn vraag met één bevestiging in als kwestie in plaats van dat hij doodloopt.
- De **bewoner** ziet bij een afgerond onderzoek of het een indicatie of een effect is.
- De **bewoner** leent een gekalibreerde meter van het lab vanuit hetzelfde scherm.
- De **bewoner** wordt niet meer gevraagd om een alias die niets meer betekent.

### Uitkomst B — het domeinmaximum

Het eindproduct is de **lokale klimaatinfrastructuur van de RTFoundation**: bewoners dragen vragen aan, het lab onderzoekt ze met bewijsgraad, de stad maakt er projecten van, leden en partners financieren ze, coöperaties en installateurs voeren uit, en de gemeente krijgt een geaggregeerd beeld. De hele keten is volgbaar, zonder score op een mens.

Nieuwe professionele processen:

1. **Wijkonderzoeker (Living Lab-rol).**
   - Proces: vraag verkennen → vraagbesluit met reden → studieplan (hypothese, methode) → ethiektoets → werving met labpas → meting met gekalibreerde apparatuur → conclusie met bewijsgraad → publicatie.
   - Bestaat grotendeels in het lab; het Klimaatfonds verwijst. Geen nieuw genre.
2. **Projectleider klimaat van een RTF-stad.**
   - Proces: gesteunde vraag of studieconclusie → projectvoorstel (KF-08) → vierogen → actief → besteding → verantwoording op projectniveau.
   - Nodig: een **eigenaarsbesluit** over de verwijzing thema → project.
3. **Energiecoöperatie als partner.**
   - Proces: registratie via het organisatieportaal → partnerovereenkomst → gezamenlijk project (bijvoorbeeld zonnepanelen op een school) → de coöperatie werft leden in de postcoderoos buiten RTG → het project toont de partner.
   - Nodig: **extern** (de coöperatie, SCE bij RVO) en een **eigenaarsbesluit** over partnerschap. Deelname in de installatie blijft buiten RTG (KF-N4) tot er een besluit is.
4. **Installateur of klusbedrijf (genre `bouw` of `vakwerk`).**
   - Proces: een project heeft een uitvoerder → offerte via de bestaande zakelijke kanalen → uitvoering → oplevering vastgelegd door het kantoor.
   - Nodig: een **eigenaarsbesluit** (koppeling project ↔ zaak). RTG belooft geen vakbekwaamheid (geen persoonseis), en dat staat op het scherm.
5. **Energiecoach als vrijwilliger.**
   - Proces: aanmelden als vrijwilliger (`werk.vrijwilligerswerk`, VOG) → huisbezoek op verzoek van een bewoner → advies (klasse **advies**, geen garantie) → eventueel meting met lab-apparatuur.
   - Nodig: een **eigenaarsbesluit** over huisbezoeken, en de beschermingsdeur blijft open (HDI.md par. 7).
6. **Gemeente als afnemer van het geaggregeerde beeld en als financier (buurtbudget).**
   - Proces: de gemeente ziet het beeld met k-drempel (KF-17) → kent een buurtbudget toe → de stichting ontvangt het als subsidiebron (`geld-bron.js: bronUitSubsidie`, herbestemming met toestemming) → verantwoording.
   - Nodig: **extern** (de subsidiebeschikking) en een **eigenaarsbesluit** over het aannemen van gemeentelijk geld.
7. **Woningmeting voor het eigen huis.**
   - Proces: het lid koppelt in Wonen zijn verbruik → het lab gebruikt het alleen met toestemming in een studie → het lid ziet een schatting als voorspelling.
   - Nodig: een **eigenaarsbesluit** en woningdata in `woning.overzicht`; geen tweede woningmodel.

Huisregels die ook in B gelden: geen klimaatranglijst, geen badges onder 18 (het labpaspoort alleen via `progressieMag`), een voorspelling is nooit een feit, alleen geaggregeerd naar de gemeente, bevestigen doet de mens bij elke doorgifte.

### Ketens LOS en SAMEN

**LOS.** Met Geven, Kwesties en Geld uit blijft de kerntaak intact: stad kiezen, vraag stellen, steunen en het onderzoek zien. Het scherm zegt bij de projecten eerlijk dat geven via Geven loopt; is dat uit, dan is de knop er niet en staat er "geven kan hier nu niet". Staat het Living Lab zelf uit, dan is er geen kerntaak, en het scherm moet dat zeggen in plaats van "Laden…" te blijven tonen (twijfel of de huidige foutafhandeling dat doet; het scherm vangt fouten wel op met een melder).

**SAMEN — keten "zonnepanelen op de school":**
1. Een bewoner stelt de vraag (Klimaatfonds, `gemeenschap.klimaatfonds`).
2. Buren steunen hem (Klimaatfonds; de stem per account staat in het Living Lab).
3. Het lab verkent hem en geeft een besluit (`onderzoek.lab`, vraagbesluit).
   - 3a. Bij `geen-lab-vraag`: de bewoner brengt hem in als kwestie (`democratie.kwestie`), met één bevestiging.
   - 3b. Bij `gestart`: er volgt een studie (themaKoppel) met een meting via de uitleen.
4. De RTF-stad maakt er een project van (`kantoor.rtfbeheer`, KF-08).
5. Leden geven geoormerkt (Geven, `geven.doneren`; RTG Pay `betalen.rtgpay`).
6. De gever ziet de besteding op projectniveau (`gift.overzicht`).
7. De gemeente ziet het geaggregeerde beeld (`portaal.toegang`).

Storingen:
- **Het Living Lab valt uit bij stap 2:** de stem gaat niet door en het scherm toont de foutmelding. Een dubbele tik telt één keer (voltooiproef).
- **Het vraagbesluit blijft uit (stap 3):** de vraag staat op `ingediend`, zonder vals antwoord.
- **Kwesties is uit (3a):** het venster zegt waar de vraag anders heen kan (gemeente) en zet niets klaar zonder bevestiging.
- **Het project stopt vóór stap 5:** Geven weigert het oormerk; er wordt niets afgeschreven.
- **RTG Pay valt uit bij stap 5:** 503 en niets afgeschreven.
- **Onder de k-drempel (stap 7):** "niet gemeten", geen nul.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | indienen, steunen, antwoord met reden, onderzoek met bewijsgraad, uitleen, project en gift zijn alle zeven bereikbaar vanuit het venster | functiecatalogus tegen de code; tabel b zonder onverklaarde "nee" |
| professionele diepte | elke professionele rol hangt aan een bestaande labrol, een bestaand genre of een kantoorrol, en het scherm belooft geen vakbekwaamheid zonder persoonseis | schermtoets op de woordkeus; BEVOEGD per rol |
| levenscyclus | elke vraag heeft een stand uit `vraagbesluit.STANDEN`, en de vraagsteller ziet hem | voltooiproef uitgebreid met verkennen, besluiten en tonen |
| samenwerking en rollen | bewoner, lab, kantoor en gever doen elk hun eigen handeling; een stem telt per account | voltooiproef (andere alias = 409); IDOR-meting voor lab2 (vandaag niet gemeten) |
| domeinintelligentie | geen conclusie staat zonder bewijsgraad, en geen getal onder de k-drempel | toets op KF-11 en KF-17 |
| los functioneren | met Geven, Kwesties en Geld uit werken vraag, steun en onderzoek volledig | voltooiproef met de koppelingen uit |
| RTG-ketens | de keten "zonnepanelen op de school" sluit van 1 tot 7, inclusief de tak 3a | ketenproef; uitvaltoets per schakel |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen op BEWEZEN, en IDOR voor lab2 gemeten | `APPWERKT.json` na hermeting; `IDOR.json` met lab2 |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar volgens SCHERMEIGENAAR.json | geen dubbele logica: wat het Klimaatfonds alleen verwijst |
|---|---|---|
| het hele lab, meedoen met een labpas | `apps/livinglab.html`, `onderzoek.lab` | vragen, stemmen en studies leest het venster van de lab-routes; er is geen tweede register |
| geven aan een project | `apps/foundation/geven.html`, `geven.doneren` | alleen de project-id |
| labfonds (toezeggen, stemmen per locatie) | `apps/labfonds.html` → alias `/apps/geld.html#labfonds` (`geld.overzicht`) | alleen een link, liefst met de locatie-id; geen bedragen in het venster |
| een vraag die geen onderzoek wordt | `apps/foundation/kwesties.html`, `democratie.kwestie` | de thema-id en de tekst, klaargezet; inbrengen bevestigt de bewoner |
| melding aan de gemeente | `apps/gemeente.html`, `overheid.gemeente-burger` | idem; twijfel of een buurtklimaatvraag daar thuishoort of bij Kwesties, aan de integrator voorleggen |
| verbruik en installatie van het eigen huis | `apps/wonen.html`, `woning.overzicht` | geen besparingsschatting in het Klimaatfonds (KF-13) |
| partners en gemeente als organisatie | `apps/foundation/os-portaal.html`, `portaal.toegang` | alleen een partnernaam bij een actief project; het beeld voor de gemeente geaggregeerd |
| projecten aanmaken en koppelen | `apps/foundation/kantoor.html`, `kantoor.rtfbeheer` (en het overzicht `apps/foundation/os.html`, `kantoor.hub`) | het venster toont alleen actieve projecten |
| vrijwillige energiecoach | `apps/foundation/os-vrijwilliger.html`, `werk.vrijwilligerswerk` | geen vrijwilligerslogica in het venster |


---

## 4. Library — `link:library`, `/apps/library.html`

Foundation LibraryOS is de werkplaats waar een maker (een lid, of een organisatie via haar Concern-eigenaar) een intellectueel werk opbouwt, met anderen afspraken maakt over wie wat mag, rechten expliciet en per handeling verleent, een editie vastlegt die nooit meer verandert, en die editie leest en van feedback voorziet. De kern is niet "bestanden opslaan" maar **een werk met een herleidbaar besluit**: wie heeft bijgedragen, onder welke afspraak, met welke rechten, en wie heeft ingestemd met precies deze inhoud (`LIBRARYOS.md`, "Domeingrenzen en invarianten": een Work is geen bestand; credit is geen bevoegdheid; geen impliciete overdracht van intellectueel eigendom). Voor wie: leden die schrijven, onderzoeken, lokale geschiedenis vastleggen of lesmateriaal maken, en organisaties die als uitgever optreden. Het is vandaag een **private pilot**: er is geen publieke catalogus, geen anonieme lezer en geen distributie buiten de betrokken partijen (`LIBRARYOS-STUDIO-READER.md`, "Grenzen en volgende stap").

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | n.v.t. (registerbewijs) | scherm `/apps/library.html` met `public/apps/library/app/app-01.js` en `app-02.js` |
| bedienbaar | BEWEZEN | n.v.t. | |
| menselijk | NIET_GETEST | afgeleid "menselijk" gesloten (3 stappen in de 8/3/4/3-telling, zie brief) | de proef leidt menselijk af; het register meet het nog niet |
| voltooibaar | GEEN_FIXTURE | sluit, 8 stappen | `scripts/lib/voltooi/library.js`: werk beginnen, hoofdstuk vastleggen, solo-afspraak + recht + editie + vrijgave, lezen/zoeken/leesplek/bladwijzer/notitie, feedback zonder dat de editie verandert, plus drie bevoegdheidsstappen (zonder account 401, ander gezin ziet niets, kind met gezinssessie opent de Library niet) |
| waarheidsgetrouw | BEWEZEN | n.v.t. | |
| persistent | GEEN_FIXTURE | sluit, 3 stappen | herstart, read-only lezer van de opslag, nieuwe sessie na herstart |
| bevoegd | BEWEZEN | BEVOEGD 1/1 kruisparen gescheiden | IDOR: alle 42 Library-routes "onbereikbaar" (de meter had geen id van A in dit domein; dus **niet** bewezen gescheiden door IDOR, wel door de voltooiproef en `test/library-http.test.js`) |
| herstelbaar | GEEN_FIXTURE | sluit, 4 stappen | dubbeltik werk, dubbeltik revisie, afgebroken bladwijzer, crash na revisie (operatie-ID + verwachte revisie) |

Wat de code doet (gelezen):

- **Routes** (`server/routes/library.js`): 42 POST-routes achter `auth`, alle met `req.session.key` als actor en `req.documentAuthority` als intrekbare bevoegdheidscontrole. Schrijfacties lopen via `library.execute` (operatie-ID verplicht, 16–100 tekens; `expectedRevision` verplicht; replay geeft hetzelfde antwoord, andere invoer met dezelfde ID geeft `REPLAY_CONFLICT`).
- **Werk en revisies** (`server/kern/library/works.js`): `work.create` (titel, type, taal, verantwoordelijke, governance-ref), `revision.add` (append-only per inhoudsanker, max. 1000 ankers × 1000 revisies × 50.000 tekens, SHA-256 per revisie).
- **Structuur** (`studio.js`): `structure.reorder` (elk anker precies één keer), `workspace`-projectie.
- **Samenwerking** (`agreements.js`): `contribution.invite/accept` (rol, scope, creditnaam, zichtbaarheid private/collaborators/public), `agreement.propose/accept` (partijen, editors, publisher, vereiste instemmers, rechthebbenden; alleen de regels `all-listed-approvers`, `all-current-and-proposed-parties`, `successor-agreement`; termsHash moet exact kloppen), `agreement.conflict` (blokkeert vrijgave tot een opvolgende afspraak het conflict oplost).
- **Rechten** (`rights.js`): `rights.grant/revoke` met twaalf afzonderlijke handelingen (`edit, publish, translate, adapt, archive, education, commercial` en vijf AI-handelingen `ai.private-summary, ai.external-inference, ai.embeddings, ai.training, ai.synthetic-voice`), scope werk/editie/ankers, talen, territoria (`WORLD` of ISO-landcode), termijn, `attributionRequired`, vervanging. Een AI-verlening moet precies één AI-doel hebben. Alleen bevoegdheidsgrond `rights-holder-declaration` (een verklaring, geen bewijs van titel).
- **Edities en vrijgave** (`editions.js`, `publication.js`): `edition.create` (eigen kopie van de laatste revisies), `edition.freeze` (bevriest afspraak, bijdragen, rechten en policy in een snapshot; weigert als een geaccepteerde bijdrager niet in de afspraak staat), `publication/preview` (wat ontbreekt: rechten, instemmingen), `publication.consent/revoke-consent` (instemming gebonden aan een `consentDigest` over editie + afspraak + grants), `publication.confirm` (herleest alles onder het collectieslot), `edition.withdraw` en `edition.warn` (beschikbaarheid en waarschuwing veranderen de inhoud niet).
- **Feedback** (`feedback.js`): zes soorten (`correction, clarity, translation, accessibility, source, other`) op een anker van een vrijgegeven editie, besluit door een editor (`accepted/rejected/needs-information`), oplossen alleen met een latere revisie; verificatie van een ChangeReceipt met eerlijke uitkomst (`improved, not-improved, mixed, unknown, not-checked`).
- **Onderwijsvrijgave** (`education.js`): `education.release/withdraw` voor geselecteerde ankers van een vrijgegeven editie, gratis, met verplichte citatie en naamsvermelding, geen afgeleide werken, geen AI; de resolver wordt gebruikt door het Leerhuis (`server/opzet/loop-fabric.js` → `server/kern/leerhuis/acties-library.js`).
- **Lezer** (`reader.js`, `reader-state.js`): openen, zoeken (max. 100 treffers), leesplek, bladwijzers, markeringen (begin/eind binnen de vastgelegde tekst), notities; eigen hashketen per lezer (`libraryReader`-collectie).
- **Bewijs en uitgaande gebeurtenissen** (`journal.js`, `loop-source.js`): per werk een hashketen met envelop, `proof`-query (scope uitdrukkelijk "lokale keten, geen externe verankering"), een duurzame outbox (ten minste eenmaal), ChangeReceipts ondertekend met `serviceProof` als die er is.
- **Opslag**: weigert zonder SQLite/PostgreSQL-collectietransacties (`STORAGE_UNAVAILABLE`); 25 MiB-grens voor de kernel en 10 MiB per lezersopslag, waarbij er nooit iets wordt weggegooid (`CAPACITY`).
- **Identiteit** (`server/opzet/library.js`): een organisatie wordt alleen door haar Concern-eigenaar vertegenwoordigd.
- **Wat de UI (nog) niet aanroept** (grep op `public/apps/library/app/*.js`): `contribution/invite`, `contribution/accept`, `agreement/conflict`, `rights/revoke`, `edition/withdraw`, `edition/warn`, `publication/revoke-consent`, `education/*`, `reader/highlight*`, `reader/proof`, `/api/library/proof`. Die bestaan dus alleen als API.
- **Niet aangesloten**: geen Library-bron in de levensgraaf (`server/kern/levensgraaf/bronnen*.js` noemt Library niet) en geen Library-regel in `kern/vergeten` (grep vond niets). Geen notificatie bij uitnodiging of feedback (`LIBRARYOS.md`: "Geen uitnodigingsmail, notificatie").

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Zenodo | één openbare dienst | geen prijs in zoekresultaat | DOI per upload en per versie, concept-DOI die naar de nieuwste versie wijst, 50 GB per record (max. 100 bestanden), communities met curator die inzendingen beoordeelt | Zenodo developers — https://developers.zenodo.org/ (zoekresultaat 2026-10-19, pagina niet geopend); Zenodo support — https://support.zenodo.org/help/en-gb/1-upload-deposit/80-what-are-the-size-limitations-of-zenodo (zoekresultaat 2026-10-19, pagina niet geopend) |
| OpenReview | geen gegevens | geen gegevens | open peerreview, conflictregistratie | OpenReview — https://openreview.net/about (zoekresultaat 2026-10-19, pagina niet geopend) |
| Overleaf | Free, Standard, Pro (duurste individueel); instellingen op aanvraag | Standard $199/jaar, Pro $399/jaar; zoekresultaten tonen verschillende versies van de pagina | samen schrijven; Pro: onbeperkt aantal medewerkers per project (Standard 10, Free 1) | Overleaf plans — https://www.overleaf.com/plans (zoekresultaat 2026-10-19, pagina niet geopend) |
| Pressbooks | Institutional Network; Shared Network (duurste, consortia) | Institutional vanaf $5.999/jaar, Shared vanaf $15.999/jaar (oudere versie $5.499 en $14.999) | eigen netwerk, onbeperkte auteursplaatsen, tot drie netwerkbeheerders; analytics per netwerk en instelling | Pressbooks Enterprise — https://pressbooks.com/enterprise-plans/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Figshare | Figshare for Institutions (op offerte); Figshare Plus | instellingen: offerte op basis van onderzoeksintensiteit en opslag; Figshare Plus $875 per 250 GB (eenmalig) | DOI via DataCite, DOI reserveren | FitGap — https://us.fitgap.com/products/figshare (zoekresultaat 2026-10-19, pagina niet geopend); Figshare — https://info.figshare.com/docs/how-to-reserve-a-doi (zoekresultaat 2026-10-19, pagina niet geopend) |
| Crossref (DOI-registratie) | lidmaatschap in tiers | US$275/jaar (omzet < $1m) tot USD 50.000/jaar; voorbeeld USD 1 per actueel tijdschriftartikel; tarieven kunnen veranderen (RCFS) | DOI-registratie, metadata bijwerken zonder kosten | Crossref fees — https://crossref.org/fees (zoekresultaat 2026-10-19, pagina niet geopend) |
| DataCite (DOI-registratie) | consortium- of direct lidmaatschap | lidmaatschapsbijdrage €2.000 (voorbeeld TIB); nieuw model 2026 zonder prijs per DOI, details niet gevonden | DOI voor data en andere objecten | TIB — https://projects.tib.eu/pid-service/en/tib-doi-konsortium/become-a-member/ (zoekresultaat 2026-10-19, pagina niet geopend); DataCite — https://datacite.org/blog/a-new-membership-model-for-a-more-equitable-datacite/ (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| versies met vaste inhoud per versie | ja (bevroren editie met `contentHash` en `snapshotHash`) |
| persistente identifier (DOI) | nee (alleen interne ref `library/edition/<id>` met versiehash) |
| concept-id naar nieuwste versie | half (`loop-source.artifact` geeft `currentRef`, niet zichtbaar in de UI) |
| licentie per publicatie | half (fijnmazige rechtenverlening per handeling; geen standaardlicentie zoals Creative Commons) |
| samen schrijven | half (meerpartijenkernel in de API; UI alleen solo) |
| communities / collecties met curator | nee |
| open peerreview met conflictregistratie | half (feedback per anker met besluit; geen reviewronde, geen conflictverklaring van reviewers) |
| publieke catalogus en zoeken | nee (zoeken alleen binnen één editie) |
| export (PDF/EPUB) | nee |
| instellingsnetwerk / consortium | nee (organisatie alleen via de Concern-eigenaar) |

### c. Het volledige domein

**Particulier.** Mensen schrijven memoires, buurtgeschiedenis, gedichten, handleidingen en lesmateriaal. Ze willen dat het bewaard blijft, dat hun naam erbij staat, en zelf bepalen wie het mag lezen of hergebruiken. Ze lezen, markeren en maken aantekeningen, en willen die privé houden.

**Professioneel.** Onderzoekers publiceren artikelen, datasets en preprints in repositories met een persistente identifier per versie (Zenodo, Figshare; DOI via DataCite of Crossref, zie b). Peerreview loopt in rondes met redacteuren, reviewers en een conflictverklaring (OpenReview, zie b). Uitgevers werken met auteurscontracten, licenties per taal en territorium, vertalingen en edities; open-access-uitgevers kiezen bijna altijd een Creative Commons-licentie. Bibliotheken lenen uit, doen aan leesbevordering en educatie en organiseren ontmoeting en debat.

**Organisatorisch.** Instellingen draaien een netwerk met beheerders en auteursplaatsen (Pressbooks Institutional/Shared Network, zie b), consortia delen DOI-lidmaatschap, en bibliotheken werken in een landelijk netwerk.

Regels en keurmerken:

- **Auteurswet**: het auteursrecht ontstaat bij de maker; overdracht en licentie zijn afzonderlijke rechtshandelingen. Dat sluit aan op de invariant "no-implicit-ip-transfer" (`server/kern/library/model.js`, `POLICY.rules`). Geen artikelnummer, want geen zoekresultaat noemde er een.
- **Creative Commons**: zes hoofdlicenties, alle met naamsvermelding (BY): CC BY, BY-SA, BY-ND, BY-NC, BY-NC-SA, BY-NC-ND. Bron: Radboud Universiteit — https://www.ru.nl/en/staff/researchers/publishing-research/open-access-publishing/creative-commons-licenses (zoekresultaat 2026-10-19, pagina niet geopend); Illinois Library — https://guides.library.illinois.edu/creativecommons/cclicenses (zoekresultaat 2026-10-19, pagina niet geopend). Wat daaruit volgt, uit eigen kennis en niet uit het zoekresultaat: een CC-licentie is voor wie het werk al kreeg niet in te trekken. Een "rights.revoke" kan dan alleen nieuwe verspreiding door RTG stoppen, niet de rechten van eerdere ontvangers. **Een jurist moet dit bevestigen.**
- **FAIR-principes** (vindbaar, toegankelijk, interoperabel, herbruikbaar): persistente identifier, metadata die blijft bestaan ook als de data weg is, gedeelde woordenlijsten, duidelijke licentie en herkomst. Bron: TU/e — https://rdm.tue.nl/docs/intro/FAIR/ (zoekresultaat 2026-10-19, pagina niet geopend); UK Data Service — https://ukdataservice.ac.uk/?p=22452 (zoekresultaat 2026-10-19, pagina niet geopend).
- **DOI**: Crossref (publicaties) en DataCite (data en overige objecten), zie b. RTG kan pas DOI's uitgeven als het lid wordt, of via een consortium; dat is een extern contract en kost geld.
- **Wet stelsel openbare bibliotheekvoorzieningen (WSOB)**: vijf functies (uitlenen, educatie, leesbevordering, ontmoeting en debat, kennismaken met kunst en cultuur) en de KB als nationale bibliotheek met een landelijke digitale bibliotheek. Bron: Eerste Kamer — https://www.eerstekamer.nl/nieuws/20141112/debat_over_wet_stelsel_openbare (zoekresultaat 2026-10-19, pagina niet geopend); kst 33846 7 — https://zoek.officielebekendmakingen.nl/kst-33846-7.html (zoekresultaat 2026-10-19, pagina niet geopend). De zoekresultaten bevestigen de huidige geldende tekst niet. **RTG is geen openbare bibliotheek in de zin van die wet en moet zich ook niet zo noemen.**
- **European Accessibility Act (EAA)**: e-boeken, leessoftware en e-commerce vallen eronder, de eisen gelden voor wat vanaf 28 juni 2025 op de markt komt, met informatieplicht over toegankelijkheidskenmerken. Micro-ondernemingen zijn uitgezonderd. Bron: Taylor Wessing — https://www.taylorwessing.com/en/interface/2022/the-european-accessibility-act/e-books-and-the-impact-of-the-european-accessibility-act (zoekresultaat 2026-10-19, pagina niet geopend); NIPI — https://nipi.hbs.is/?page_id=62 (zoekresultaat 2026-10-19, pagina niet geopend). Over de Nederlandse uitvoeringswet: geen gegevens.
- **AVG/UAVG**: lees- en notitiedata zijn persoonsgegevens (`journal.js` en `reader-state.js` geven `classificatie: 'persoonsgegeven'`). Inzage, export en wissen zijn rechten van het lid. `LIBRARYOS.md` zegt zelf dat er geen AVG-retentie/export/wisworkflow is.
- **DSA**: zodra er publieke ontsluiting is, wordt RTG hostingdienst voor die inhoud, met een meld- en actiemechanisme (art. 16) en motivering van beperkingen. Bron: Presencis — https://presencis.com/regulations/dsa/article-16/ (zoekresultaat 2026-10-19, pagina niet geopend). Dat het om art. 17 gaat bij de motivering, bevestigden de zoekresultaten niet eenduidig.

Wat daaruit volgt voor de app:
1. De rechtenkern is sterker dan die van de marktleiders (handeling, doel, taal, territorium, AI-doel apart). Wat ontbreekt is de **standaardtaal** die de buitenwereld leest: CC-licentie, citatie en identifier.
2. Duurzame archivering en FAIR vragen een **externe verankering** en metadata die blijven bestaan. Dat is een verwijzing naar `server/lib/keten-anker.js` en geen nieuwe motor.
3. Publieke ontsluiting komt pas na moderatie (DSA), toegankelijke representatie (EAA) en de AVG-workflow, en die volgorde staat al in `LIBRARYOS-STUDIO-READER.md`.
4. Peerreview is een **proces met rollen**, geen likesysteem en geen reviewerscore (geen cijfer op een mens, FOUNDATION 5.4).

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk**: sterk. Werk, revisies, lezen en notities bestaan en zijn bewezen. Wat ontbreekt zijn collecties, markeringen in de UI en export van de eigen data.
- **L2 Professioneel via bestaande genres**: zwak. Er is geen genre voor uitgever, bibliotheek of onderzoeksinstelling. Alleen `journalistiek` (caps `redactie`) en `creator` (genres-register `server/seed/genres-lijst-b.js`) en organisaties via Concern liggen ernaast. De rechtenkern zelf is professioneel diep.
- **L3 Organisatorisch**: half. De meerpartijenafspraak en organisatie-als-partij bestaan in de API, maar er is geen UI en geen redactie- of reviewrol.
- **L4 Domeinintelligentie**: minimaal. Er is een preview die zegt wat er ontbreekt voor vrijgave. Geen bron- of citatiesignalering. Een voorspelling is nooit een feit.
- **L5 Volledige levenscyclus**: half. Concept, editie, vrijgave, intrekken en waarschuwen bestaan. Archivering, export, AVG-wissen en opvolging bij overlijden ontbreken.
- **L6 RTG-samenhang**: dun. Alleen de EducationRelease naar het Leerhuis is aangesloten. Geen wek via Berichten, geen levensgraaf-projectie.

**LIB-01 Werk beginnen en revisies vastleggen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `libraryKernel` (`works.js`), revisies append-only met hash.
- Regels en rekenwijze: elke revisie krijgt een volgnummer en SHA-256 over canonieke JSON. Een anker behoudt zijn soort. Grenzen: 1000/1000/50.000.
- Onzekerheid: geen. De hash is integriteit en geen waarheid (`LIBRARYOS.md`).
- Wie hoort wat, wanneer: alleen leden van het werk zien het (`policy.member`).
- Rollen en toestemming: verantwoordelijke of editor uit de actieve afspraak.
- Uitzonderingen: zonder SQLite/PostgreSQL weigert de opslag met 503. Een kind zonder eigen account opent de Library niet (voltooiproef).
- Acceptatiecriterium: Gegeven een lid met een eigen account, wanneer hij een werk begint en twee keer met dezelfde operatie-ID een revisie bewaart, dan staat er één werk met één revisie, en na een herstart staat die er nog.

**LIB-02 Structuur ordenen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `w.structure` (`studio.js`).
- Regels en rekenwijze: de nieuwe volgorde bevat elk anker precies één keer.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: leden van het werk via `workspace`.
- Rollen en toestemming: editor.
- Uitzonderingen: een bestaande editie verandert niet mee.
- Acceptatiecriterium: Gegeven een werk met drie ankers, wanneer de editor ze herordent met een ontbrekend anker, dan weigert de server met `INVALID_STRUCTURE` en blijft de oude volgorde staan.

**LIB-03 Lezer: openen, zoeken, leesplek, bladwijzer, notitie, markering** · L1 · half (markering zit niet in de UI) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `libraryReader`-collectie per lezer, hashketen per lezer.
- Regels en rekenwijze: alleen op een vrijgegeven editie. Een markering valt binnen de vastgelegde tekst (max. 2000 tekens) en draagt `excerptHash`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de lezer zelf. Niemand anders ziet leesplek, bladwijzer of notitie.
- Rollen en toestemming: lid van het werk.
- Uitzonderingen: een ingetrokken editie blijft voor de lezer leesbaar met `distribution.status` erbij (`reader.open` geeft de distributiestand mee).
- Acceptatiecriterium: Gegeven een vrijgegeven editie, wanneer de lezer een zin markeert en de pagina herlaadt, dan staat de markering op dezelfde plek, en een tweede lid ziet hem niet.

**LIB-04 Coauteurs en bijdragers uitnodigen** · L3 · half (API ja, UI nee) · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `w.contributions` (`agreements.js`).
- Regels en rekenwijze: rol, scope (werk of ankers), creditnaam en zichtbaarheid. Accepteren geeft geen algemene inzage in het concept. Credit is geen bevoegdheid.
- Onzekerheid: de creditnaam is wat de bijdrager opgeeft. RTG controleert die niet.
- Wie hoort wat, wanneer: de genodigde moet het weten. Vandaag gaat er **geen melding** uit (zie LIB-15).
- Rollen en toestemming: alleen de werkbeheerder nodigt uit. Alleen de genodigde (of wie hem vertegenwoordigt) accepteert.
- Uitzonderingen: een organisatie wordt alleen door haar Concern-eigenaar vertegenwoordigd. Een minderjarige zonder eigen account kan geen partij zijn.
- Acceptatiecriterium: Gegeven een werk en een tweede lid, wanneer de beheerder hem in het scherm als coauteur uitnodigt, dan ziet het tweede lid de uitnodiging in zijn Library en kan hij accepteren, maar het concept niet lezen voordat hij partij is in de afspraak.

**LIB-05 Werkafspraak met meerdere partijen en conflict** · L3 · half (solo-UI; meerpartijen en conflict alleen via de API) · kosten middel · complexiteit hoog · aanbevolen nu
- Gegevens en bron: `w.agreements`, `activeAgreementId`.
- Regels en rekenwijze: een afspraak wordt pas actief als alle huidige en voorgestelde partijen met de exacte `termsHash` hebben aanvaard. Een conflict blokkeert vrijgave tot een opvolgende afspraak het oplost (`resolvesConflict`).
- Onzekerheid: geen rekenwerk. Juridisch is de afspraak een vastlegging van wil en geen getoetst contract.
- Wie hoort wat, wanneer: elke partij moet zien dat er een voorstel ligt of een conflict is gemeld (vandaag zonder wek).
- Rollen en toestemming: elke partij stemt zelf in. Een mens bevestigt (FOUNDATION par. 2).
- Uitzonderingen: geen arbitrage (`LIBRARYOS.md`: "rechtenconflict-arbitrage" niet gebouwd). Een vastgelopen conflict blijft dus vastzitten tot de partijen samen iets voorstellen.
- Acceptatiecriterium: Gegeven een werk met twee partijen, wanneer één partij een conflict meldt, dan weigert `publication.confirm` met `BLOCKING_CONFLICT`, en het scherm zegt wie wat moet doen om verder te gaan.

**LIB-06 Rechten verlenen en intrekken, met afzonderlijke AI-rechten** · L2 · half (verlenen in UI voor solo; intrekken alleen via de API) · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `w.grants` (`rights.js`).
- Regels en rekenwijze: twaalf handelingen, één AI-doel per AI-verlening, talen en territoria expliciet, termijn, vervanging.
- Onzekerheid: de bevoegdheidsgrond is een verklaring van de rechthebbende en geen bewijs van titel. Het scherm moet dat zo zeggen.
- Wie hoort wat, wanneer: grantor, grantee en de partijen in de afspraak.
- Rollen en toestemming: alleen een rechthebbende uit de actieve afspraak verleent of trekt in.
- Uitzonderingen: intrekken stopt een nieuwe vrijgave (`RIGHTS_MISSING`), maar haalt een al vrijgegeven editie niet terug. Daarvoor bestaat `edition.withdraw`.
- Acceptatiecriterium: Gegeven een vrijgegeven editie, wanneer de rechthebbende in het scherm zijn publicatierecht intrekt, dan kan een nieuwe editie niet meer worden vrijgegeven en zegt de preview welk recht ontbreekt.

**LIB-07 Editie bevriezen, instemmen en vrijgeven** · L5 · bestaat · kosten klein · complexiteit hoog · aanbevolen nu
- Gegevens en bron: `w.editions`, `w.releases` (`editions.js`, `publication.js`).
- Regels en rekenwijze: de snapshot bindt inhoud, afspraak, bijdragen, rechten en policy. De instemming is gebonden aan de `consentDigest`. Confirm herleest alles onder het slot.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alle vereiste instemmers.
- Rollen en toestemming: elke vereiste instemmer stemt zelf in, en de publisher bevestigt. Dat is één menselijke bevestiging per partij.
- Uitzonderingen: verandert de afspraak na het bevriezen, dan vraagt dat een nieuwe editie (`AGREEMENT_CHANGED`).
- Acceptatiecriterium: Gegeven een bevroren editie met twee vereiste instemmers, wanneer er één instemt, dan weigert de vrijgave met `APPROVALS_MISSING`, en na de tweede instemming lukt hij precies één keer.

**LIB-08 Editie intrekken of waarschuwen** · L5 · half (API ja, UI nee) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `e.distribution`, `e.warnings`.
- Regels en rekenwijze: de inhoud blijft byte voor byte gelijk. Alleen de beschikbaarheid of de waarschuwing verandert, met een reden.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lezers zien de waarschuwing bij het openen (`reader.open` geeft `warnings` mee). Een melding aan eerdere lezers bestaat niet.
- Rollen en toestemming: publisher.
- Uitzonderingen: intrekken haalt een EducationRelease niet automatisch weg. Die resolver geeft `SOURCE_UNAVAILABLE` zodra de editie niet meer vrijgegeven is, dus het Leerhuis ziet het bij de volgende controle.
- Acceptatiecriterium: Gegeven een vrijgegeven editie, wanneer de publisher een waarschuwing "jaartal in hoofdstuk 2 onjuist" plaatst, dan ziet elke lezer die waarschuwing bovenaan, en de `contentHash` is onveranderd.

**LIB-09 Inhoudelijke feedback per anker, met besluit en oplossing** · L3 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `w.feedback` (`feedback.js`).
- Regels en rekenwijze: feedback hoort bij een anker van een vrijgegeven editie. Een oplossing vraagt een **latere** revisie. Een verificatie verwijst naar een echte ChangeReceipt.
- Onzekerheid: de uitkomst van een verificatie kan `unknown` of `not-checked` zijn, en dat blijft zo staan.
- Wie hoort wat, wanneer: de editor moet het weten (vandaag zonder wek). De indiener ziet het besluit in de lijst.
- Rollen en toestemming: elk lid van het werk geeft feedback. De editor besluit.
- Uitzonderingen: feedback op een concept kan niet (`RELEASE_REQUIRED`).
- Acceptatiecriterium: Gegeven feedback "noem de bron" op editie 1, wanneer de editor hem aanneemt en in editie 2 oplost, dan blijft editie 1 ongewijzigd en draagt editie 2 een ChangeReceipt die naar de feedback verwijst.

**LIB-10 Onderwijsvrijgave naar het Leerhuis** · L6 · half (kernel en Leerhuis-resolver ja, Library-UI nee) · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `w.educationReleases` (`education.js`). De lezer is `server/kern/leerhuis/acties-library.js`.
- Regels en rekenwijze: alleen gekozen ankers uit één vrijgegeven editie, voor één Academy-organisatie en -context, gratis, citatie en naamsvermelding verplicht, geen afgeleide werken, geen AI. Elk gebruik controleert de rechten opnieuw.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het Leerhuis vraagt het bij gebruik op. Bij intrekking krijgt het `RELEASE_WITHDRAWN`.
- Rollen en toestemming: publisher, en een `education`-recht van elke rechthebbende.
- Uitzonderingen: rechten ingetrokken, dan `EDUCATION_RIGHTS_REVOKED`.
- Acceptatiecriterium: Gegeven een vrijgegeven editie en een onderwijsrecht, wanneer de maker in de Library hoofdstuk 1 vrijgeeft voor één Leerhuis-cursus, dan kan die cursus het hoofdstuk tonen met citatie, en na intrekken niet meer.

**LIB-11 Bewijs van de geschiedenis van een werk** · L5 · half (API ja, UI nee) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `s.journal` per werk, `proof`-query.
- Regels en rekenwijze: hashketen plus een vergelijking van de actuele werkhash en de integriteit van de editie.
- Onzekerheid: de scope is uitdrukkelijk "lokaal, geen externe verankering". Het scherm moet dat zeggen.
- Wie hoort wat, wanneer: leden van het werk.
- Rollen en toestemming: lid.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een werk met tien gebeurtenissen, wanneer een lid "Bewijs" opent, dan ziet hij de keten met "intact" en de zin dat er nog geen externe verankering is.

**LIB-12 Licentie kiezen (Creative Commons) als weergave van de rechtenverlening** · L2 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: geen nieuwe gegevens. Een CC-keuze vertaalt zich naar een set `rights.grant`-regels (bijv. CC BY = publish + adapt + commercial, WORLD, `attributionRequired: true`, geen einddatum) en een licentielabel in de snapshot.
- Regels en rekenwijze: een vaste tabel CC-licentie → handelingen, op één plek in `server/kern/library/`. **AI-handelingen worden nooit uit een CC-keuze afgeleid**; die blijven een eigen keuze.
- Onzekerheid: de juridische werking van CC-licenties op AI-training en de onherroepelijkheid zijn voor een jurist. Het scherm zegt: "Een open licentie kun je later niet terugdraaien voor wie het al heeft."
- Wie hoort wat, wanneer: de rechthebbende ziet vóór het bevestigen in gewone taal wat anderen mogen.
- Rollen en toestemming: elke rechthebbende stemt in. Eén menselijke bevestiging.
- Uitzonderingen: een werk met bijdragen van een minderjarige of zonder geaccepteerde afspraak krijgt geen open licentie.
- Acceptatiecriterium: Gegeven een solowerk, wanneer de maker "CC BY" kiest en bevestigt, dan ontstaan de bijbehorende grants met naamsvermelding verplicht, staat "CC BY 4.0" in de snapshot, en `rights.revoke` op zo'n grant zegt dat eerdere ontvangers hun rechten houden.

**LIB-13 Citatie en vaste verwijzing per versie** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de bestaande `editionRef` (`library/edition/<werk>:<editie>` met `snapshotHash`) en `currentRef` uit `loop-source.artifact`.
- Regels en rekenwijze: een citeerregel uit titel, creditnamen met zichtbaarheid `public`, editie, taal, datum en vaste verwijzing. Een "concept"-verwijzing wijst naar de nieuwste vrijgave, een "versie"-verwijzing naar precies deze.
- Onzekerheid: dit is **geen DOI**. Het scherm noemt het "RTG-verwijzing".
- Wie hoort wat, wanneer: elke lezer.
- Rollen en toestemming: geen extra rol. Alleen namen met zichtbaarheid `public` komen in de citatie (codenamen en kluis blijven buiten).
- Uitzonderingen: een bijdrager met zichtbaarheid `private` staat er niet in, en de citatie zegt "en anderen".
- Acceptatiecriterium: Gegeven een editie met een publieke en een private bijdrager, wanneer een lezer "Citeer" kiest, dan ziet hij alleen de publieke naam, plus de versieverwijzing die na editie 2 nog steeds naar editie 1 wijst.

**LIB-14 Collecties** · L1/L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: een collectie is een lijst **verwijzingen** naar edities (`editionRef`), persoonlijk in de lezersopslag of gedeeld in een eigen werk van het type "collectie". Geen kopie van inhoud.
- Regels en rekenwijze: een verwijzing naar een editie die de lezer niet mag openen, toont "niet beschikbaar voor jou" en nooit de titel.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: een persoonlijke collectie alleen de eigenaar. Een gedeelde collectie de partijen van dat collectiewerk.
- Rollen en toestemming: een curator (editor van het collectiewerk) voegt toe. De auteur van de opgenomen editie hoeft niet in te stemmen zolang de collectie niet publiek is; voor publieke collecties wel (later, met LIB-20).
- Uitzonderingen: een ingetrokken editie blijft in de collectie staan, met de stand "ingetrokken".
- Acceptatiecriterium: Gegeven twee vrijgegeven edities, wanneer een lid ze in een persoonlijke collectie "Buurtgeschiedenis" zet en er één wordt ingetrokken, dan toont de collectie die ene met "ingetrokken" en de andere gewoon.

**LIB-15 Wek bij uitnodiging, afspraak, instemmingsverzoek en feedback** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de outbox in `journal.js` (gebeurtenissen bestaan al). De wek gaat via dezelfde `meldLid`-vorm die DemocratieOS gebruikt (`server/kern/democratie/wek.js`).
- Regels en rekenwijze: de wek zegt **niet** welk werk of welke inhoud ("Er ligt iets voor je in de Library"). Het bewijs is de eigen lijst in de Library, niet het bericht.
- Onzekerheid: een gedempte melding telt niet als gewekt.
- Wie hoort wat, wanneer: de genodigde, de instemmer, de editor.
- Rollen en toestemming: geen. De wek nodigt niet zelf uit, want uitnodigen deed de beheerder al.
- Uitzonderingen: rusttijden van het lid gaan voor.
- Acceptatiecriterium: Gegeven een uitnodiging als coauteur, wanneer die wordt vastgelegd, dan staat er binnen één verwerking een melding in Berichten zonder de titel van het werk, en de uitnodiging staat in de Library-lijst van de genodigde, ook als de melding niet uitging.

**LIB-16 Eigen gegevens exporteren en wissen (AVG)** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `libraryReader` (persoonlijk) en de rol van het lid in `libraryKernel`.
- Regels en rekenwijze: lezersdata kunnen volledig worden geëxporteerd en gewist. Kerneldata (bijdragen, instemmingen, vrijgaven) zijn ook rechten en besluiten van **anderen**. Daar gaat bij vergeten de koppeling naar de mens weg en blijft de regel staan, zoals `server/kern/democratie/koppeling.js` dat doet.
- Onzekerheid: hoe lang een instemming bewaard moet blijven als bewijs voor medeauteurs, is een juridische afweging. Twijfel: aan de integrator voorleggen.
- Wie hoort wat, wanneer: partijen in een werk zien bij een vergeten partij "partij heeft gebruikgemaakt van het recht op vergetelheid".
- Rollen en toestemming: het lid zelf, vanuit Mijn gegevens.
- Uitzonderingen: een hashketen mag niet breken. Wissen van inhoud gaat via een nieuwe gebeurtenis plus het weghalen van de leesbare tekst, en dat vraagt een ontwerpbesluit (zie f).
- Acceptatiecriterium: Gegeven een lid met notities en één instemming, wanneer hij in Mijn gegevens "Library-gegevens wissen" bevestigt, dan zijn zijn notities weg, toont de proof-keten nog "intact", en staat zijn instemming er nog zonder koppeling naar zijn account.

**LIB-17 Structuur en toegankelijke representatie (koppen, alternatieve tekst, leesvolgorde)** · L5 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: binnen dezelfde revisie een gestructureerde vorm (koppen, lijsten, alt-tekst), zoals `LIBRARYOS-STUDIO-READER.md` als "volgende veilige stap" noemt.
- Regels en rekenwijze: toegankelijkheidskenmerken worden per editie vermeld (informatieplicht EAA, zie c). "Niet gecontroleerd" is geen "toegankelijk".
- Onzekerheid: of RTG onder de micro-uitzondering van de EAA valt, is niet vastgesteld.
- Wie hoort wat, wanneer: lezers zien de kenmerken vóór het openen.
- Rollen en toestemming: editor.
- Uitzonderingen: oude edities blijven zoals ze zijn. Een toegankelijke versie is een nieuwe editie.
- Acceptatiecriterium: Gegeven een editie met een afbeelding zonder alt-tekst, wanneer de editor wil bevriezen, dan zegt de preview "1 afbeelding zonder beschrijving" en staat de editie bij de kenmerken op "niet volledig beschreven".

**LIB-18 Export als PDF/EPUB** · L5 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de bevroren snapshot. De export krijgt de `contentHash` mee.
- Regels en rekenwijze: alleen met een `publish`-recht dat de taal en het territorium van de lezer dekt. Exporteren is verspreiden.
- Onzekerheid: EPUB-toegankelijkheid hangt af van LIB-17.
- Wie hoort wat, wanneer: lezer.
- Rollen en toestemming: lid van het werk.
- Uitzonderingen: een ingetrokken editie is niet meer te exporteren.
- Acceptatiecriterium: Gegeven een vrijgegeven editie, wanneer een lezer EPUB kiest, dan krijgt hij een bestand waarvan de hash van de tekstinhoud overeenkomt met de editie, en bij een ingetrokken editie krijgt hij een weigering met reden.

**LIB-19 Reviewronde (gestructureerde peerreview)** · L2/L3 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: een reviewronde als object in het werk: editie, reviewers (bijdragers met rol `reviewer` en scope), vragen, rapporten (als feedback met soort), besluit van de editor. Reviewers verklaren een **belangenconflict** vóór toegang (zoals OpenReview, zie b).
- Regels en rekenwijze: open of besloten review per ronde, vastgelegd in de afspraak. Een rapport is gebonden aan de editiehash. **Geen reviewerscore, geen ranglijst van reviewers, geen tellers per persoon** (geen cijfer op een mens).
- Onzekerheid: deskundigheid van een reviewer wordt niet door RTG vastgesteld. Het scherm zegt "door de editor uitgenodigd", niet "expert".
- Wie hoort wat, wanneer: reviewer na zijn conflictverklaring. De auteur ziet rapporten pas na het besluit van de editor (bij een besloten ronde).
- Rollen en toestemming: de editor nodigt uit, de reviewer accepteert, de editor besluit.
- Uitzonderingen: een reviewer die partij is in de afspraak kan geen onafhankelijke reviewer zijn.
- Acceptatiecriterium: Gegeven een editie en een uitgenodigde reviewer die een conflict verklaart, wanneer hij toch wil openen, dan weigert de Library en ziet de editor "reviewer heeft een belangenconflict gemeld".

**LIB-20 Publieke ontsluiting en catalogus** · L3 · ontbreekt · kosten groot · complexiteit hoog · later
- Gegevens en bron: een publieke projectie van vrijgegeven edities met het recht `publish` en territorium `WORLD`. Het creditveld `visibility: public` bestaat al als "opgeslagen intentie voor een latere publieke projectie" (`LIBRARYOS.md`).
- Regels en rekenwijze: geen ranking op populariteit en geen "trending" (geen verslavende patronen). Volgorde op datum of titel.
- Onzekerheid: pas na moderatie (DSA), AVG-workflow en toegankelijkheid. Dat zegt de repo zelf.
- Wie hoort wat, wanneer: iedereen met minimaal een gratis account (huisregel). Een anonieme lezer zonder account valt alleen onder een van de zes uitzonderingen in AGENTS.md als het eigenaarsbesluit dat zegt.
- Rollen en toestemming: elke rechthebbende stemt in met publieke vermelding.
- Uitzonderingen: geen werk van een minderjarige in de publieke catalogus zonder ouderlijke instemming (zie LIB-23).
- Acceptatiecriterium: Gegeven een vrijgegeven editie met een WORLD-publicatierecht, wanneer de publisher "Opnemen in de catalogus" bevestigt, dan vindt een ander lid hem via zoeken, kan hij hem melden (DSA), en verdwijnt hij uit de catalogus zodra het recht wordt ingetrokken.

**LIB-21 Melden en moderatie van gepubliceerde inhoud** · L3 · ontbreekt · kosten middel · complexiteit midden · later (voorwaarde voor LIB-20)
- Gegevens en bron: melding met reden, plaats (anker) en verklaring te goeder trouw. Besluit met motivering en bezwaar. Een eigen collectie in het Library-domein of de bestaande kantoorroute.
- Regels en rekenwijze: de beperking is een `edition.warn` of een verwijdering uit de catalogus, **nooit** een stille wijziging van de inhoud.
- Onzekerheid: of iets onrechtmatig is, beoordeelt een mens. RTG oordeelt niet over waarheid.
- Wie hoort wat, wanneer: de melder krijgt het besluit, de publisher de motivering.
- Rollen en toestemming: een kantoormedewerker op naam.
- Uitzonderingen: een melding van een rechthebbende (auteursrechtinbreuk) gaat voor.
- Acceptatiecriterium: Gegeven een catalogusvermelding, wanneer een lid hem meldt als inbreuk, dan krijgt de melder een ontvangstbevestiging, en het besluit op naam met reden staat daarna zowel bij de melder als bij de publisher.

**LIB-22 Signaleren: ontbrekende bron, rechten en citatie (domeinintelligentie)** · L4 · half (preview noemt ontbrekende rechten en instemmingen) · kosten klein · complexiteit midden · later
- Gegevens en bron: alleen de inhoud van het werk zelf. Een lokaal model (`LOCAL_AI_URL`) en alleen met een `ai.private-summary`-recht van elke rechthebbende.
- Regels en rekenwijze: het model wijst beweringen zonder bron aan, als **vermoeden**. Elke markering heet "mogelijk".
- Onzekerheid: een voorspelling is nooit een feit. "Niet gecontroleerd" is geen "klopt".
- Wie hoort wat, wanneer: alleen de editor, in het concept.
- Rollen en toestemming: de editor zet het per werk aan. Zonder AI-recht bestaat de knop niet.
- Uitzonderingen: met `RTG_EXTERNE_AI_UIT=1` en zonder lokaal model zegt het scherm "handmatige werkmodus".
- Acceptatiecriterium: Gegeven een werk zonder `ai.private-summary`-recht, wanneer de editor de controle zoekt, dan is die er niet; mét dat recht ziet hij maximaal een lijst "mogelijk zonder bron" en verandert er niets aan de tekst.

**LIB-23 Maker onder de 18** · L1 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: een kind met een eigen account. De ouder vertegenwoordigt het via de bestaande gezinsrelatie (`identities.represents` uitbreiden is een besluit).
- Regels en rekenwijze: geen open licentie en geen publieke catalogus zonder instemming van de ouder. **Geen progressie** (geen tellers, badges of "aantal gepubliceerd").
- Onzekerheid: de juridische handelingsbevoegdheid van minderjarigen bij licenties is voor een jurist.
- Wie hoort wat, wanneer: de ouder bij elke vrijgave.
- Rollen en toestemming: kind maakt, ouder stemt in.
- Uitzonderingen: de beschermingsdeur (HDI.md par. 7) blijft open. Een kind kan altijd zelf hulp zoeken, ook buiten de ouder om.
- Acceptatiecriterium: Gegeven een kind van 14 met een eigen account, wanneer het een editie wil vrijgeven, dan vraagt de Library de instemming van een ouder, en zonder die instemming blijft de editie bevroren maar niet vrijgegeven.

**LIB-24 Externe verankering en duurzame archivering** · L5 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de hash over de journaalketen naar `server/lib/keten-anker.js` (bestaat). Een archiefkopie bij een externe duurzame bewaarder vraagt een contract.
- Regels en rekenwijze: in het anker alleen hashes, nooit inhoud of persoonsgegevens.
- Onzekerheid: welke bewaarder, en hoe lang, is een eigenaarsbesluit.
- Wie hoort wat, wanneer: de proof-weergave zegt "verankerd op <datum>".
- Rollen en toestemming: systeem. Een archiefkopie van inhoud vraagt een `archive`-recht van elke rechthebbende (die handeling bestaat al in `ACTIONS`).
- Uitzonderingen: geen archiefkopie zonder `archive`-recht.
- Acceptatiecriterium: Gegeven een werk met een vrijgave, wanneer de ankerdienst draait, dan zegt de proof-weergave "verankerd", en een met opzet gewijzigde gebeurtenis maakt "intact" onwaar.

**LIB-25 DOI uitgeven via DataCite of Crossref** · L2 · ontbreekt · kosten middel · complexiteit midden · later (extern contract, eigenaarsbesluit)
- Gegevens en bron: metadata uit de snapshot (titel, publieke creditnamen, editie, licentie). Registratie bij DataCite of Crossref (zie b voor de kosten).
- Regels en rekenwijze: één DOI per vrijgegeven editie en één concept-DOI per werk. Metadata blijven bestaan na intrekking (FAIR, "metadata blijven beschikbaar").
- Onzekerheid: een DOI is permanent. Een ingetrokken editie houdt haar DOI met de stand "ingetrokken".
- Wie hoort wat, wanneer: de publisher bevestigt, want dit bereikt een instantie: één menselijke bevestiging.
- Rollen en toestemming: publisher, en alle rechthebbenden voor publieke metadata.
- Uitzonderingen: geen DOI zonder publieke credit en zonder publicatierecht WORLD.
- Acceptatiecriterium: Gegeven een vrijgegeven editie, wanneer de publisher "DOI aanvragen" bevestigt, dan staat de aanvraag op "klaargezet" tot het register hem bevestigt, en pas dan toont de citatie de DOI.

**LIB-26 Uitleen van commerciële e-boeken (bibliotheekfunctie)** · L3 · niet doen (nieuw domein vóór V1)
- Reden: e-lending onder licenties van uitgevers is een eigen domein met eigen contracten en hoort, voor zover bestaand, bij `media.boeken` (`apps/boeken.html`); de Library is een werkplaats voor eigen werk.

**LIB-27 Royalty's en verkoop van edities** · L5 · niet doen (nieuw domein vóór V1)
- Reden: dat is een geldstroom met eigen fiscale klassen en een marktplaats. `LIBRARYOS.md` sluit "marketplace, royalty-engine" uit, en de handeling `commercial` blijft een recht en geen kassa.

### e. RTG-exclusief

1. **Van buurtgeschiedenis naar les, zonder kopie.** Een maker schrijft in de Library (eigenaar Library), geeft hoofdstuk 1 vrij voor onderwijs (Library, LIB-10), het Leerhuis toont het met citatie en controleert bij elk gebruik opnieuw de rechten (Leerhuis, `leerhuis.werk`). Trekt de maker in, dan valt het weg uit de cursus zonder dat iemand iets hoeft te verwijderen. Uniek omdat de rechtenkern en de leeromgeving via een verwijzing (`releaseRef`) verbonden zijn en niet via een kopie.
2. **Feedback die aantoonbaar tot verbetering leidt.** Lid geeft feedback (Library), editor besluit (Library), oplossing in editie 2 met ChangeReceipt (Library), het Living World-protocol leest de ontvangstbevestiging (`server/kern/loop-fabric/*`, loop-fabric). De lezer kan zien dat zijn opmerking echt iets veranderde, en de oorspronkelijke editie blijft ongewijzigd.
3. **Een kwestie wordt een werk.** Uit Kwesties (`democratie.kwestie`) komt een uitkomst met reden. Een lid of buurtgroep maakt er in de Library een werk van ("Wat de buurt deed aan de lantaarn"), met een verwijzing naar het kwestienummer en zonder kopie van de kwestie. Kwesties bezit de kwestie, de Library het werk.
4. **AI-rechten die de maker per doel uitdeelt.** Geen andere app in het huis heeft vijf afzonderlijke AI-handelingen per werk. Rahul (stuurlaag) mag een samenvatting maken alleen als `ai.private-summary` is verleend. De Library is eigenaar van het recht, de AI-laag is alleen lezer.
5. **Organisatie als uitgever.** Een Concern-entiteit (`werk.concern`) is publisher. De Library leest alleen wie de eigenaar is (`server/opzet/library.js`). Een stichting of school kan zo uitgeven zonder tweede rechtenmodel.

### f. Bouwstenen en ontbrekende koppelingen

Staat: `server/kern/library/*.js` (15 bestanden), `server/routes/library.js`, `server/opzet/library.js`, `server/opzet/loop-fabric.js` (EducationRelease-resolver naar het Leerhuis), `public/apps/library.html` + `public/apps/library/app/app-01.js`, `app-02.js`, toetsen `test/library-kernel.test.js`, `test/library-http.test.js`, `test/library-sqlite.test.js`, `test/library.pg.test.js` (genoemd in `LIBRARYOS.md`), `scripts/lib/voltooi/library.js`, `server/lib/keten-anker.js`.

Ontbreekt, per koppeling:

| van → naar | soort | wat |
|---|---|---|
| Library → Berichten (`comm.berichten`) | verwijzing (wek) | LIB-15: melding zonder inhoud, zoals `democratie/wek.js` |
| Library → Mijn gegevens (`privacy.gegevens`) | projectie + vergeten-haak | LIB-16: lezersdata in export. Een `vergeet`-functie in de Library, aangeroepen zoals `kern.democratieVergeet` in `server/opzet/kernlaag7-ruimtes.js` |
| Library → levensgraaf | projectie | een bron "werken waar ik partij in ben" (titel en stand, nooit inhoud) in `server/kern/levensgraaf/bronnen-*.js` |
| Library → ankerdienst | verwijzing (hash) | LIB-24 via `server/lib/keten-anker.js` |
| Kwesties → Library | verwijzing (`KW-…`) | een werk mag een kwestienummer als `governanceRef` of bron dragen. Geen kopie |
| Library → Leerhuis | verwijzing (bestaat) | UI voor LIB-10 in de Library zelf ontbreekt |
| Library → Concern | lezen (bestaat) | vertegenwoordiging door anderen dan de eigenaar (bijv. een redacteur) is niet gebouwd en vraagt een rol in Concern |
| Library → extern DOI-register | extern | LIB-25, contract |

Ontwerpgrens om te bewaken: wissen van inhoud (AVG) tegenover de hashketen. De keten hasht de inhoud mee (`stateHash: M.hash(w)`). Voor wissen moet de inhoud vervangen kunnen worden door een "gewist"-gebeurtenis terwijl de oude hash als verwijzing blijft staan. **Dat is een ontwerpbesluit binnen de bestaande kernel en geen nieuwe laag.**

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| LIB-04 coauteurs uitnodigen (UI) | nu | middel | midden | LIB-15 |
| LIB-05 meerpartijenafspraak + conflict (UI) | nu | middel | hoog | LIB-04 |
| LIB-06 rechten intrekken (UI) | nu | klein | midden | — |
| LIB-08 intrekken/waarschuwen (UI) | nu | klein | laag | — |
| LIB-03 markering (UI) | nu | klein | laag | — |
| LIB-10 onderwijsvrijgave (UI) | nu | klein | midden | Leerhuis bestaat |
| LIB-11 bewijs (UI) | nu | klein | laag | — |
| LIB-12 CC-licentie | nu | klein | midden | juridische toets onherroepelijkheid (extern) |
| LIB-13 citatie + vaste verwijzing | nu | klein | laag | — |
| LIB-14 collecties | nu | middel | midden | — |
| LIB-15 wek | nu | klein | laag | Berichten (`meldLid`) |
| LIB-16 AVG export/wissen | nu | middel | midden | ontwerpbesluit wissen vs. keten; Mijn gegevens |
| LIB-17 toegankelijke representatie | later | middel | midden | EAA-toets (extern) |
| LIB-18 export PDF/EPUB | later | middel | midden | LIB-17 |
| LIB-19 reviewronde | later | middel | hoog | LIB-04, LIB-15 |
| LIB-20 publieke catalogus | later | groot | hoog | LIB-16, LIB-17, LIB-21, eigenaarsbesluit (toegang zonder account?) |
| LIB-21 melden en moderatie | later | middel | midden | kantoorrol op naam |
| LIB-22 signaleren | later | klein | midden | lokaal model, AI-recht |
| LIB-23 maker onder 18 | later | middel | hoog | eigenaarsbesluit vertegenwoordiging, jurist |
| LIB-24 externe verankering | later | middel | midden | ankerdienst, eigenaarsbesluit bewaarder |
| LIB-25 DOI | later | middel | midden | LIB-13, LIB-24, contract DataCite/Crossref, eigenaarsbesluit |
| LIB-26 e-lending | niet doen | — | — | nieuw domein |
| LIB-27 royalty's | niet doen | — | — | nieuw domein |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket "Samen maken, eerlijk delen": LIB-04, LIB-05, LIB-06 (intrekken), LIB-08, LIB-03 (markering), LIB-10 (UI), LIB-11 (UI), LIB-12, LIB-13, LIB-14, LIB-15, LIB-16. Bijna alles hiervan is **UI op een bestaande API** of een vertaaltabel binnen `server/kern/library/`. Er komt geen nieuwe motor of nieuwe collectie bij, behalve een persoonlijke collectielijst in de bestaande lezersopslag.

Wat de gebruiker daarna kan en nu niet:
- een coauteur uitnodigen, samen een afspraak sluiten en een conflict melden en oplossen, met een melding in Berichten in plaats van een stille API;
- een standaardlicentie kiezen die de buitenwereld begrijpt (CC BY enzovoort), met de eerlijke zin dat een open licentie niet terug te draaien is;
- een editie citeren met een vaste verwijzing per versie;
- edities in collecties bewaren;
- een fout in een vrijgegeven editie zichtbaar maken met een waarschuwing, of de editie intrekken;
- een hoofdstuk vanuit de Library vrijgeven voor een Leerhuis-cursus;
- zijn eigen leesdata exporteren en wissen.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **open kennis- en publicatiehuis** waarin een maker, een redactie, een reviewer, een bibliotheek en een school elk hun eigen professionele proces doorlopen op dezelfde rechtenkern.

Nieuwe professionele processen die RTG kan ondersteunen:

1. **Redactioneel uitgeefproces (uitgeverij of stichting als uitgever).** Wie: een uitgeefstichting of kleine uitgever als Concern-entiteit, met redacteuren en correctoren. Proces: manuscript ontvangen → contract (afspraak) → redactierondes → correctie → toegankelijke opmaak → editie → licentie → DOI → catalogus → errata. Rol en genre: er is **geen genre "uitgeverij"**. Het dichtstbij is `journalistiek` (caps `redactie`). **Eigenaarsbesluit: nieuw genre of uitbreiding van een bestaand genre**, en vertegenwoordiging door medewerkers in plaats van alleen de Concern-eigenaar. Extern: Crossref- of DataCite-lidmaatschap (zie b). Wet: Auteurswet (contracten), EAA.
2. **Open peerreview voor onderzoek.** Wie: onderzoekers, een redactieraad, reviewers. Proces: inzending → conflictverklaring reviewers → besloten of open rondes → besluit → gepubliceerde rapporten met eigen verwijzing → versie 2. Rol: editor, reviewer, auteur. Genre: geen. Reviewers zijn leden met een uitnodiging, en deskundigheid wordt niet door RTG vastgesteld. **Eigenaarsbesluit:** of rapporten zelf werken met een eigen licentie worden. Extern: DOI per rapport (zoals OpenReview/Zenodo-praktijk, zie b).
3. **Onderzoeksdata-repository volgens FAIR.** Wie: onderzoekers en Living Lab-projecten. Proces: dataset → metadata → licentie → DOI → embargo → bewaartermijn → metadata blijven na verwijdering. **Eigenaarsbesluit: datasets (bestanden) in de Library**, want vandaag is een revisie alleen tekst (max. 50.000 tekens). Dat vraagt een bestandsopslag en is een **nieuwe opslagkoppeling**. Wet: AVG bij persoonsgegevens in data. Koppeling: Living Lab (`onderzoek.lab`) verwijst naar een dataset, nooit andersom.
4. **Schoolbibliotheek en lesmateriaal.** Wie: scholen (`werk.schoolbeheer`), docenten, leerlingen. Proces: docent maakt lesmateriaal → CC-licentie → onderwijsvrijgave → RTG School/Leerhuis gebruikt het → feedback van leerlingen → nieuwe editie. Leerlingen maken werk onder ouderlijke instemming (LIB-23), zonder progressie en zonder publieke ranglijst. **Eigenaarsbesluit:** vertegenwoordiging van minderjarigen.
5. **Openbare bibliotheek als partner (WSOB-functies ontmoeting en debat, leesbevordering).** Wie: een lokale bibliotheekorganisatie. Proces: een bibliotheek cureert een publieke collectie van lokale werken, organiseert een leesclub of debat (koppeling met Kwesties en Agenda), en archiveert lokale geschiedenis. Extern: een samenwerkingsovereenkomst. **Eigenaarsbesluit:** partnerkanaal voor bibliotheken. RTG noemt zich nooit een openbare bibliotheek.
6. **Duurzame bewaring en erfenis.** Wie: de maker en zijn erfgenamen. Proces: bewaarplan → externe archiefkopie → opvolger aanwijzen in de afspraak (`departureRule: successor-agreement` bestaat al als vorm) → na overlijden beheert de opvolger de rechten. Koppeling: Nalatenschap (`scripts/lib/voltooi/nalatenschap.js` bestaat als app; eigenaar volgens SCHERMEIGENAAR niet nagekeken). **Eigenaarsbesluit:** rechtsopvolging en externe bewaarder.
7. **Toegankelijke uitgave.** Wie: een redactie met een toegankelijkheidsspecialist. Proces: structuur → alt-teksten → toegankelijke EPUB → toegankelijkheidsverklaring per editie (EAA-informatieplicht). Extern: EPUB-toegankelijkheidstoets.
8. **Vertaling.** Wie: een vertaler als bijdrager met een `translate`-recht. Proces: recht per taal en territorium (bestaat) → vertaalde editie als opvolger met een andere taal → vergelijking per anker. **Nieuw:** vergelijkweergave per anker.

Wat per stap nodig is: zie de punten. Alle publieke onderdelen vragen eerst LIB-21 (moderatie, DSA) en LIB-16 (AVG). Commerciële verkoop en e-lending blijven **buiten B vóór V1** (nieuw domein). Daarna is het een eigenaarsbesluit.

### Ketens LOS en SAMEN

**LOS.** Als alle andere apps uit staan, blijft de kerntaak volledig: werk maken, revisies, afspraak, rechten, editie, vrijgave, lezen en feedback. Alles woont in `libraryKernel` en `libraryReader`. Wat het scherm dan eerlijk zegt:
- zonder Berichten: "Er gaat geen melding uit. Kijk zelf in je Library wat er voor je klaarligt." (vandaag is dat de enige stand);
- zonder Leerhuis: de onderwijsvrijgave kan worden vastgelegd, en het scherm zegt "Nog niet gebruikt in een cursus";
- zonder durable opslag (geen SQLite/PostgreSQL): "Deze handeling vereist duurzame collectietransacties" (503), en niets wordt half vastgelegd;
- zonder lokaal model: LIB-22 bestaat niet, "handmatige werkmodus".

**SAMEN — keten "Een buurtgeschiedenis wordt lesmateriaal".**
1. Lid A brengt in Kwesties in: "De geschiedenis van de overstroming van 1953 in onze buurt raakt vergeten." — eigenaar Kwesties (`democratie.kwestie`).
2. Lid A start een actie in het DoeNetwerk "verhalen verzamelen"; leden B en C sluiten zelf aan — eigenaar Kwesties (DoeNetwerk, `kern/democratie/doe.js`).
3. A begint in de Library het werk "Geschiedenis van De Wilg" met het kwestienummer als verwijzing — eigenaar Library.
4. A nodigt B en C uit als coauteur (LIB-04); zij krijgen een wek in Berichten (LIB-15) — eigenaar Library; bezorging Berichten (`comm.berichten`).
5. Afspraak met drie partijen, A als publisher (LIB-05) — eigenaar Library.
6. Ieder verleent een publicatierecht en kiest samen CC BY (LIB-12) — eigenaar Library.
7. Editie 1 wordt bevroren, drie instemmingen, vrijgave (LIB-07) — eigenaar Library.
8. A geeft hoofdstuk 2 vrij voor een Leerhuis-cursus van de buurtschool (LIB-10) — eigenaar Library; gebruik Leerhuis (`leerhuis.werk`).
9. Een leerling gebruikt het in de cursus; de docent geeft feedback "noem de bron van de foto" (LIB-09) — eigenaar Leerhuis (gebruik) en Library (feedback).
10. Editie 2 lost het op; ChangeReceipt — eigenaar Library.
11. Het kantoor sluit de kwestie met `samen-opgelost` en een toelichting die naar het werk verwijst — eigenaar Kwesties (kwestiekantoor, `kantoor.democratie`).

Storingen:
- **Berichten valt uit (stap 4):** de uitnodiging staat vast in de Library. B ziet haar als hij de Library opent. Het scherm van A zegt "uitgenodigd, nog niet geaccepteerd". Er gaat niets verloren.
- **C trekt zijn recht in tussen stap 6 en 7:** de preview zegt "Publicatierecht ontbreekt voor C". Vrijgave weigert met `RIGHTS_MISSING`. A ziet wie wat moet doen.
- **C meldt een conflict na stap 7:** editie 1 blijft vrijgegeven. Een nieuwe editie kan pas na een opvolgende afspraak. De onderwijsvrijgave blijft geldig zolang de rechten gelden.
- **Het Leerhuis valt uit (stap 8–9):** de onderwijsvrijgave staat vast. De cursus toont het hoofdstuk tijdelijk niet. Er is geen verlies.
- **A trekt editie 1 in:** de resolver geeft `SOURCE_UNAVAILABLE`. De cursus toont "Bron niet meer beschikbaar" in plaats van een stille kopie.
- **Kwesties valt uit (stap 11):** het werk bestaat los. De verwijzing `KW-…` toont "kwestie niet bereikbaar". De Library houdt niets van de kwestie bij.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | alle 25 functies "bestaat/half/ontbreekt" uit d hebben een stand, en elke "nu"-functie is in de UI bereikbaar (geen API-only handeling uit de lijst in a) | grep van de UI op alle `/api/library/*`-routes. Elke route heeft een knop of een gedocumenteerde reden |
| professionele diepte | een meerpartijenwerk met drie partijen, een CC-licentie, een citatie en een reviewronde doorloopt de hele cyclus zonder API-hulp | voltooiscenario uitgebreid met drie accounts en een reviewer |
| levenscyclus | concept → editie → vrijgave → waarschuwing → intrekking → AVG-wissen → bewijs "intact" | voltooiproef + `test/library-kernel.test.js` met een wis-scenario |
| samenwerking en rollen | geen enkele handeling slaagt voor een rol die haar niet heeft (beheerder, editor, publisher, rechthebbende, instemmer, reviewer, lezer) | BEVOEGD-kruisparen per rol, minimaal 7×7. IDOR met een **gevulde** fixture zodat geen route "onbereikbaar" blijft |
| domeinintelligentie | elke AI-uitkomst draagt "mogelijk", werkt alleen met een verleend AI-recht en verandert nooit tekst | toets: zonder `ai.private-summary` 403. Met recht geen mutatie in de keten |
| los functioneren | met Berichten, Leerhuis, Kwesties en het model uit doorloopt de voltooiproef alle kernstappen | voltooiproef met diensten uit (`test/library-http.test.js` "optionele diensten uit" bestaat al als vorm) |
| RTG-ketens | de keten "buurtgeschiedenis wordt lesmateriaal" loopt eind-tot-eind via verwijzingen. In geen enkele collectie van een andere app staat Library-inhoud | ketenproef + een scan dat `libraryKernel`-tekst niet in andere collecties voorkomt |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN, ook menselijk, voltooibaar, persistent en herstelbaar in het register (nu G/N) | APPWERKT.json na een register-run met fixture |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar volgens SCHERMEIGENAAR.json | wat de Library alleen verwijst (geen dubbele logica) |
|---|---|---|
| melding van uitnodiging, feedback, instemmingsverzoek | `apps/comm.html`, capability `comm.berichten` | de Library zet een wek klaar. Berichten bezorgt. Het bewijs blijft de eigen lijst in de Library |
| lesmateriaal gebruiken in een cursus | `apps/leerhuis-werk.html`, capability `leerhuis.werk` (en `apps/leerhuis.html`, `leerhuis.mijn`) | alleen `releaseRef`. Het Leerhuis bewaart geen kopie van de tekst |
| schoolgebruik door kinderen | `apps/rtgschool.html`, capability `leren.school` | twijfel: aan de integrator voorleggen (de EducationRelease is gebouwd voor het Leerhuis/Academy, niet voor RTG School) |
| export en wissen van eigen gegevens | `apps/mijn-gegevens.html`, capability `privacy.gegevens` | de Library levert een export en een vergeet-haak. Mijn gegevens toont en start |
| organisatie als uitgever, medewerkers met een rol | `apps/concern.html`, capability `werk.concern` | de Library leest alleen "wie vertegenwoordigt deze entiteit" |
| commerciële e-boeken lezen | `apps/boeken.html`, capability `media.boeken` | geen. Twijfel: aan de integrator voorleggen of de Library-lezer en Boeken één leeslaag moeten delen (twee lezers met eigen leesplek-logica is mogelijk dubbele logica) |
| identiteit gekeurd (voor een DOI of publieke credit) | `apps/verificatie.html`, capability `identiteit.verificatie` | de Library vraagt alleen "gekeurd ja/nee" |
| onderzoeksproject koppelt een dataset | `apps/livinglab.html`, capability `onderzoek.lab` | het Lab verwijst naar een `editionRef`. De Library kent het Lab niet |
| redactie van een journalistieke zaak publiceert | `apps/redactie.html`, capability `zaak.redactie` | twijfel: aan de integrator voorleggen (overlap tussen redactie en uitgeefproces uit Uitkomst B) |
| kwestie als aanleiding voor een werk | `apps/foundation/kwesties.html`, capability `democratie.kwestie` | alleen het nummer `KW-…` |

---


---

## 5. Connect — `link:connect`, `/apps/connect.html`

Connect (op het scherm: **Ontdekken**) is het ontdeknetwerk van FoundationOS, voor leden (`/api/connect/*`) en gezinsleden met een eigen profiel, ook kinderen (`/api/rtf/connect/*`). De belofte is een eindige ontdeklus: twaalf plekken met bij elk een reden, een schuif tussen vertrouwd en nieuw die de mens zelf zet, en een leerdossier dat vastlegt wat iemand heeft gedaan (tien treden, per onderwerp, zonder score of niveau). Connect is geen contentplatform. Het bezit alleen drie collecties: wat iemand ermee deed (naklank), wat hij deed (dossier) en wat hij zei te willen (horizon). De inhoud zelf blijft van de domeinen die haar maken: leerstof, buurtactiviteiten en mediawerk.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | n.v.t. | |
| bedienbaar | NIET_GETEST | n.v.t. | Het scherm heeft knoppen voor openen, meer/minder, "Dit snap ik", schuif, verras en werk erbij. Er is geen knop voor naklank of kring (zie hieronder). |
| menselijk | NIET_GETEST | 3 stappen menselijk-afgeleid gesloten | |
| voltooibaar | NIET_GETEST | 8 stappen gesloten (`scripts/lib/voltooi/connect.js`) | De proef loopt over de gezinsdeur. De ledendeur en de naklank van een tweede mens lopen via `scripts/lusproef.js` (CONNECT.md par. 7.1: 17 schakels gesloten). |
| waarheidsgetrouw | BEWEZEN | n.v.t. | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | herstart, opslaglezer, nieuwe gezinssessie vanuit het account |
| bevoegd | BEWEZEN | binnen de 8 voltooistappen: 3 bevoegdheidsstappen | IDOR: 9 publiek, 1 nagekeken, 27 onbereikbaar ("onbereikbaar" = niet bewezen). BEVOEGD: 5/5 kruisparen gescheiden. |
| herstelbaar | GEEN_FIXTURE | 5 stappen gesloten | dubbele tik op Dit snap ik, Bekijken en Meer hiervan (met `idem`, ook na SIGKILL), afgebroken schuif, crash na noteren |

**Wat de code doet (gelezen):**

- `server/routes/connect.js`: 27 registraties in het bestand. Elke handeling heeft een ledendeur met `auth` en een gezinsdeur met `gezinsPoort`. Het gaat om ontdek, open, naklank, dossier, werk, portfolio, noteer, horizon, schuif, signaal, kring en kring/keuzes, en daarnaast drie alleen voor leden: `naklank/weg`, `naklank/tel` en `uitleg`. De kop van het bestand spreekt nog van "tweeëntwintig"; dat is verouderd. Er is met opzet geen deur voor publiceren naar `publiek` en geen route die mensen opsomt.
- `server/routes/connect-gezinsdeur.js`: `gezinsPoort` (via `rtf.verifieerProfiel`) laat gasten niet door, omdat een gastprofiel geen codenaam heeft. De vlag `beschermd` komt uit de sessie en nooit uit het verzoek. **Let op:** de ledendeur zet `beschermd: false` vast. Of een minderjarige een eigen ledenaccount kan hebben en daarmee langs de kringgrens komt, heb ik niet vastgesteld.
- `server/kern/connect/index.js`: de bedrading. `makerVan` en `werkenVan` lezen `kern/mediaos/werkherkomst.js`. `portfolio` voegt `worldContributions` toe uit `kern.livingWorld.portfolio` (`server/opzet/kernlaag7-ruimtes.js`).
- `mixer.js`: 8 motoren en 12 vaste plekken, zonder score of weging. Het antwoord geeft `genoeg` mee en een reden per plek. Er hangen 3 bronnen aan: interesse en nieuwsgierig (`bron-leerstof.js`, op `kern/leerstof` DOELEN) en lokaal (`bron-lokaal.js`, op `kern/rtfos/publiek`, alleen informatie die op een poster mag). De motoren groei, menselijk, brug, actualiteit en toeval melden dat ze niet kijken. De kop van index.js zegt "vier van de acht niet aangesloten", maar de code en CONNECT.md par. 7 zeggen vijf.
- `horizon.js`: de schuif (0–100, standaard 40), vijf signalen (meer, minder, ken, nietVoorMij, verras) en `GEEN_SIGNAAL` (kijktijd, scrollsnelheid, tijdstip, leeftijd en locatie zijn bij naam geweigerd). Een onderwerp dat op een contactgegeven lijkt, wordt geweigerd. De herhaalsleutel `idem` onthoudt de laatste vijftig tikken.
- `leerdossier.js`, `tredenlijst.js`, `dossierlezer.js` en `portfolio.js`: tien treden (gezien, uitgelezen, begrepen, geoefend, toegepast, gemaakt, aangeboden, bereikt, gebruikt, doorgegeven). Voor elke trede staat vast wie hem mag zetten: zelf (`vermoed`), het systeem (`gemeten`) of een ander (`bewezen`). Waar dat moet, eist de trede een bron. Een deel van de treden kan per ding maar één keer voorkomen. Het dossier rekent per onderwerp de hoogste trede uit en nooit een totaal. Het portfolio laat alles met `aanspraak: 'geen'` weg (gezien, uitgelezen, bereikt), en elk bewijsstuk draagt zijn `nietZegt` mee. Bij 2000 regels grijpt een noodrem in, die aangeeft hoeveel hij afkapt.
- `naklank.js` en `naklanklijst.js`: zes naklanken zonder totaal, die aan het werk hangen en niet aan de persoon. De maker wordt opgezocht en niet aangenomen. Een naklank op eigen werk wordt geweigerd. `mooi` levert geen dossierregel op. De andere soorten leveren via de haak `bijOverdracht` ten hoogste één regel `gebruikt` of `doorgegeven` per werk op.
- `kring.js`: vijf kringen (alleenIk, gezin, team, community, publiek). Een beschermd profiel komt maximaal tot `team`. Versmallen mag altijd. `zet()` geeft alleen een besluit terug: in de gelezen code wordt geen kring aan een ding bewaard.
- `lus.js` en `werkwoordlijst.js`: acht werkwoorden met hun voorwaarden. `bevestigtEenMens` noemt deel, verbind en help. `zonder()` rekent uit wat er wegvalt als een werkwoord verdwijnt. In `NIET_GEBOUWD` staan beoordeel, rangschik, beloon en andere woorden met hun reden.
- `verwijzing.js`: een bron die een mens zelf invult, moet een verwijzing zijn in de vorm `herkomst:id` die deze laag ook zelf had kunnen uitgeven. Zo kan er geen vrije tekst (bijvoorbeeld de naam van een ander) in het dossier komen.
- `werkbij.js` en `openen.js`: `gezien` ontstaat alleen bij openen en nooit bij tonen. Eigen werk uit het herkomstregister wordt als `gemaakt` en `aangeboden` overgenomen.
- Scherm `public/apps/connect.html`: vier secties (Ontdek, Jij, Waarom dit?, Nog niet hier). Het scherm zegt zelf eerlijk dat delen, maken en samenwerken nog geen knop hebben.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Hoplr | gratis bewonersapp; betaald dashboard voor overheden | bewoners gratis; overheidsprijs niet gepubliceerd | buurtnetwerk, geen advertenties, gemeente communiceert per buurt | Hoplr — https://www.hoplr.com/ (eerdere zoekresultaten); Wikipedia — https://en.wikipedia.org/wiki/Hoplr (zoekresultaat 2026-10-19, pagina niet geopend); GovLaunch — https://govlaunch.com/products/hoplr (zoekresultaat 2026-10-19, pagina niet geopend) |
| WhatsApp Communities | — | geen gegevens | groepen onder één community | WhatsApp — https://faq.whatsapp.com/438859978317289/ (eerdere zoekresultaten, pagina niet geopend) |
| Nextdoor (groepen) | app gratis | "Free" (App Store-vermelding) | groepen per buurt, nabije buurten of stad; open of besloten; adresverificatie; Events; Help Map | App Store — https://apple.co/2dh8ulj (zoekresultaat 2026-10-19, pagina niet geopend) |
| Brilliant (ontdekkend leren) | Premium jaarlijks, maandelijks, gezinsplan tot 6 leden | US $240 per jaar of $30 per maand (eigen helppagina) | interactieve lessen; gezinsplan; gratis toegang voor K-12-docenten via educatorprogramma | Brilliant — https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Khan Academy / Khanmigo (duurste: Districts Enterprise) | Learner $4/mnd, Parent $4/mnd, Enterprise Starter en Enterprise | individueel $4 per maand (alleen VS); districtsprijzen alleen via derden en onderling tegenstrijdig, dus niet overgenomen | AI-leerhulp, schrijfcoach, beheerrapportage, rostering (Clever/ClassLink) | Khan Academy — https://support.khanacademy.org/hc/da/articles/42088251619213 (zoekresultaat 2026-10-19, pagina niet geopend) |

**Welke kernfuncties wij hebben:**

| functie | stand |
|---|---|
| ontdekken op interesse | ja (motor interesse) |
| buiten de eigen bubbel | ja (nieuwsgierig met 28 bruggen; CONNECT.md par. 7) |
| lokaal aanbod | half: alleen op een plaats die de mens zelf opgeeft, bron `rtfos/publiek` |
| groepen of community's | nee: de kring bestaat als poort, maar er wordt geen groep of lidmaatschap bewaard |
| gezinsplan | ja: een eigen dossier per gezinsprofiel via de gezinsdeur |
| leerbewijs en portfolio | ja, en strenger dan de markt (graad en `nietZegt` per regel) |
| waardering | half: de naklankroutes bestaan, maar er is geen knop op het scherm |
| publiceren of delen | nee, met opzet (er is nog geen bevestigingsstroom) |
| AI-leerhulp | nee in Connect zelf; die zit in Schrift en School |
| geen advertenties of aandachtsmeting | ja, strenger dan de markt (`GEEN_SIGNAAL`) |

### c. Het volledige domein

**Particulier.** Mensen ontdekken iets via drie routes: via iemand die ze kennen ("kijk eens"), via een plek in de buurt (bieb, buurthuis, club) en via een stroom (YouTube, TikTok). De eerste twee leveren doen en begrijpen op; de derde levert vooral aandacht op. Ouders willen dat een kind iets ontdekt zonder dat het in een eindeloze stroom of in een publiek profiel belandt. Volwassenen willen kunnen aantonen wat ze kunnen, en daar is een kijklijst geen bewijs voor.

**Professioneel.** Bibliothecarissen, jongerenwerkers, buurtsportcoaches, museumdocenten, bijlesgevers en mentoren zetten ontdekkingen klaar, maar hebben geen kanaal dat niet op bereik draait. Van hen komt de motor "menselijk" ("een vakmens met driehonderd volgers"). Dit huis kent hen alleen als zaak in een bestaand genre (`server/seed/genres-lijst-a.js`: alleen `rijschool` heeft `industry: 'education'`) of als vrijwilliger (`werk.vrijwilligerswerk`).

**Organisatorisch.** Gemeenten (Hoplr-model), bibliotheken, scholen en clubs willen hun aanbod laten vinden. Waar dat betaald gebeurt, moet het herkenbaar zijn. TRAVELCOMMERCE.md, aangehaald in CONNECT.md par. 9.5: betaald bereik mag nooit vermomd worden als neutrale educatieve waarheid.

**Regels en kaders:**

- **AVG en UAVG.** Onder de 16 jaar geeft de ouder of wettelijk vertegenwoordiger toestemming bij online diensten die op toestemming steunen. Een secundaire bron noemt hiervoor art. 5 UAVG bij art. 8 AVG. Legiscope — https://www.legiscope.com/blog/avg-kinderopvang.html ; privacy-web.nl — https://privacy-web.nl/en/artikelen/minderjarigen-social-media-en-sharenting-artikel-1-3/ (zoekresultaat 2026-10-19, pagina niet geopend). Een actuele tekst van de AP zelf heb ik niet gevonden.
- **Geen verslavende patronen** (AGENTS.md) en **leren is geen wedstrijd**. Connect dwingt beide al af in de code.
- **Leerdossier onder vier voorwaarden** (FOUNDATION.md par. 5.5), in code in `leerdossier.js`.

**Wat volgt voor de app:**

1. De verwerkingsgrond voor een kindprofiel moet expliciet zijn: wie gaf toestemming, en kan het kind die vanaf 16 jaar zelf intrekken of overnemen?
2. Lokaal aanbod van organisaties moet het label "aanbieder" dragen, en betaald aanbod een eigen label.
3. Connect toont alleen wat het eigen huis heeft gezegd. Een vakmens komt binnen via een bestaand domein (werkherkomst), niet via een eigen profiel in Connect.

### d. Functiecatalogus L1–L6

Oordeel per laag:
- **L1 Persoonlijk:** sterk. Lus, schuif, dossier en portfolio staan en zijn bewezen. Naklank en kring missen nog een knop.
- **L2 Professioneel:** zwak. Een vakmens komt alleen binnen via werkherkomst of als activiteit in de buurtbron, en er is geen genre "educatie" met persoonseis.
- **L3 Organisatorisch:** afwezig. Een kring bestaat als besluit, maar er wordt niets bewaard of gedeeld.
- **L4 Domeinintelligentie:** half. Drie van de acht motoren kijken, de bruggen hebben de graad `vermoed`, en er is geen meting die die graad onderbouwt.
- **L5 Volledige levenscyclus:** half. Ontstaan en vastleggen staan. Intrekken, meenemen, bewaartermijn en de overgang naar 18 ontbreken.
- **L6 RTG-samenhang:** half. Leerstof, rtfos/publiek, mediaos/werkherkomst en livingWorld zijn verbonden. School, Schrift, projecten en de levensgraaf niet.

**CON-01 Ontdeklijst met twaalf plekken, reden per plek en "genoeg"** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhouden)
- Gegevens en bron: `mixer.js` krijgt van de bronnen de onderwerpen, de opgegeven plaats en de datum, maar geen codenaam.
- Regels en rekenwijze: de plekken worden om beurten over de motoren per kant verdeeld. Het aantal ontdekkende plekken is `round(12 × schuif/100)`. Er is geen weging.
- Onzekerheid: de bruggen hebben de graad `vermoed`. Een motor zonder bron zegt dat hij niet kijkt.
- Wie hoort wat, wanneer: alleen de mens zelf, op het moment dat hij de lijst opvraagt.
- Rollen en toestemming: een lid via `auth`, een gezinslid via `gezinsPoort`; gasten worden geweigerd.
- Uitzonderingen: zonder plaats meldt de lokale motor `plaatsGevraagd`.
- Acceptatiecriterium: Gegeven een gezinsprofiel met schuif 40, wanneer het Ontdek opent, dan ziet het hoogstens 12 plekken, elk met `waarom` en `dektNiet`, en bij de laatste plek een tekst "genoeg".

**CON-02 Openen schrijft "gezien", tonen niet** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `openen.js` met de verwijzingszeef van `verwijzing.js`.
- Regels en rekenwijze: "gezien" staat één keer per onderwerp en bron in het dossier (eenmalig).
- Onzekerheid: geen; het systeem heeft het gemeten (graad `gemeten`).
- Wie hoort wat, wanneer: niemand anders. "Gezien" komt nooit in het portfolio.
- Rollen en toestemming: alleen het eigen dossier.
- Uitzonderingen: een id die niet de vorm `herkomst:id` heeft, wordt geweigerd met een reden.
- Acceptatiecriterium: Gegeven een ontdekking, wanneer de mens twee keer op Bekijken tikt, dan staat er één regel "gezien" in zijn dossier en geen in het portfolio.

**CON-03 Horizon: schuif, vijf signalen, eenmalig verrassen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `horizon.js`.
- Regels en rekenwijze: het gewicht per onderwerp blijft tussen −3 en +3. "Verras me" verzet de schuif niet. Een dubbele tik met dezelfde `idem` telt één keer.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de mens zelf.
- Rollen en toestemming: de mens zelf, ook een kind.
- Uitzonderingen: een onderwerp dat op een contactgegeven lijkt, wordt geweigerd.
- Acceptatiecriterium: Gegeven schuif 40, wanneer de mens op "Verras me" tikt, dan krijgt dit ene verzoek alleen ontdekkende plekken en staat de schuif daarna nog op 40.

**CON-04 Leerdossier: zelf noteren ("Dit snap ik", "toegepast")** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `leerdossier.js` en `tredenlijst.js`.
- Regels en rekenwijze: `doorWie` moet kloppen bij de trede. Begrepen en toegepast mag de mens zelf zetten; die regels krijgen de graad `vermoed`.
- Onzekerheid: dat iemand iets begrepen of toegepast heeft, is niet na te gaan, en het antwoord zegt dat.
- Wie hoort wat, wanneer: de mens zelf. Volgens de vierde voorwaarde ook wie een rechtmatige verhouding tot hem heeft, maar daar is vandaag geen route voor (zie CON-12).
- Rollen en toestemming: alleen de eigen sleutel. Er is geen parameter waarmee je een ander kunt opgeven.
- Uitzonderingen: "onderwezen" of "gebruikt" zelf zetten wordt geweigerd (400).
- Acceptatiecriterium: Gegeven een kindprofiel, wanneer het "begrepen" noteert bij "breuken", dan staat die regel in het eigen dossier met graad `vermoed`, en ziet de ouder hem niet in het ouderdossier.

**CON-05 Portfolio: bewijsstukken met `stelt`, `nietZegt` en graad, zonder getal** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `portfolio.js`, aangevuld met `worldContributions` uit livingWorld.
- Regels en rekenwijze: alleen de aanspraken eigenDoen en overdracht. Geen aantallen.
- Onzekerheid: per regel staat de graad erbij (vermoed, gemeten of bewezen).
- Wie hoort wat, wanneer: alleen de eigenaar. Naar buiten tonen bestaat nog niet (zie CON-14).
- Rollen en toestemming: de eigen sleutel.
- Uitzonderingen: "bereikt" staat in het dossier maar niet in het portfolio.
- Acceptatiecriterium: Gegeven een dossier met de regels gezien, begrepen en bereikt, wanneer het portfolio wordt opgevraagd, dan staat alleen "begrepen" erin, met zijn `nietZegt`, en komt in het antwoord geen getalveld voor.

**CON-06 Naklank op het scherm (zes knoppen, terugnemen, wat de maker ziet)** · L1 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de routes `/api/connect/naklank`, `/naklank/weg` en `/naklank/tel` bestaan. De gezinsdeur kent alleen `/naklank`, zonder terugnemen of tellen. Op `connect.html` staat geen knop.
- Regels en rekenwijze: zes aparte aantallen zonder totaal. De maker wordt via `makerVan` gevonden. Een naklank op eigen werk wordt geweigerd.
- Onzekerheid: als de maker onbekend is, wordt de naklank geteld maar ontstaat er geen dossierregel, met `dossierReden` erbij.
- Wie hoort wat, wanneer: de maker ziet de aantallen. Alleen de gever ziet zijn eigen keuzes.
- Rollen en toestemming: elke ingelogde mens. Een kind mag geven; dat schrijft niets bij zichzelf, alleen bij de maker.
- Uitzonderingen: terugnemen moet ook voor een gezinsprofiel werken. Vandaag ontbreekt de gezinsroute daarvoor, en een uitweg die er niet is, is geen uitweg.
- Acceptatiecriterium: Gegeven een kindprofiel dat "geprobeerd" heeft gegeven, wanneer het op terugnemen tikt, dan is zijn keuze weg en blijft de dossierregel bij de maker staan, met de uitleg waarom.

**CON-07 Kring kiezen voor eigen werk** · L1 · half · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `kring.js` zet en controleert, maar bewaart niets. De kring zou moeten wonen bij het ding, in het domein dat het werk bezit (mediaos/werkherkomst), en niet in Connect.
- Regels en rekenwijze: versmallen mag altijd. Een beschermd profiel komt maximaal tot `team`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: wie een nabijheid heeft die kleiner of gelijk is aan het bereik van het ding (`magZien`).
- Rollen en toestemming: alleen de maker. Een ouder kan niet verbreden namens een kind; een kind kan altijd versmallen.
- Uitzonderingen: een onbekende kring of relatie geeft "dicht".
- Acceptatiecriterium: Gegeven een kind met werk in `team`, wanneer het `community` kiest, dan krijgt het de weigering met reden. Wanneer het daarna `alleenIk` kiest, lukt dat direct.

**CON-08 Motor "groei": vervolg op wat ik zelf deed** · L4 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: het eigen dossier (`dossierlezer.hoogste`). De motor krijgt de onderwerpen en de hoogste trede per onderwerp, maar geen sleutel, zoals de andere bronnen.
- Regels en rekenwijze: een onderwerp met de hoogste trede gezien, uitgelezen of begrepen levert een leerstofdoel uit hetzelfde vak op. Geen weging.
- Onzekerheid: een voorspelling dat iemand dit "nu nodig heeft" is geen feit; de reden zegt "u was hiermee bezig".
- Wie hoort wat, wanneer: alleen de mens zelf.
- Rollen en toestemming: geen nieuwe rechten nodig.
- Uitzonderingen: zonder dossier zegt de motor dat hij keek en niets vond.
- Acceptatiecriterium: Gegeven een dossier met "begrepen" bij rekenen, wanneer Ontdek wordt geladen, dan staat er een plek van de motor groei met de reden "Sluit aan op iets waar u aan werkte", en meldt `motoren()` dat groei is aangesloten.

**CON-09 Lokaal aanbod van clubs, bieb en zaken, met aanbiederlabel** · L2 · half · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: `bron-lokaal.js` leest `kern/rtfos/publiek` (posterveilig). Zaken uit bestaande genres zijn er geen bron voor.
- Regels en rekenwijze: elke plek draagt `aanbieder` en `plekVrij`, en vervalt op zijn datum.
- Onzekerheid: dat er plek vrij is, wordt pas bij de aanbieder bevestigd.
- Wie hoort wat, wanneer: de aanbieder hoort niets, tot de mens zelf naar de ingang gaat.
- Rollen en toestemming: alleen genres uit `bewijs.js` en `persoonseis.js`. Een activiteit voor kinderen van een zaak met de persoonseis "werk" telt alleen als die eis is gehaald.
- Uitzonderingen: betaald aanbod wordt pas getoond na een eigenaarsbesluit (CONNECT.md par. 9.5).
- Acceptatiecriterium: Gegeven een buurtactiviteit zonder vrije plek, wanneer zij in de lijst staat, dan zegt de plek "vol" en verdwijnt zij niet stil.

**CON-10 Challenges van organisaties** · L2 · ontbreekt · aanbevolen niet doen (vóór het besluit)
- Reden: CONNECT.md par. 9.5 laat open of een organisatie een challenge mag plaatsen, en er is geen laag die betaald bereik van neutrale leerstof scheidt.

**CON-11 Aanbieden: de kring verruimen met één menselijke bevestiging** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `lus.verklaar` geeft `bevestigtEenMens` voor `deel`. De kring wordt bewaard bij het werk (CON-07).
- Regels en rekenwijze: klaarzetten in Connect, bevestigen door de maker (één tik met een samenvatting: wie kan het straks zien). Daarna schrijft het systeem `aangeboden`.
- Onzekerheid: `aangeboden` zegt niet dat iemand het heeft gezien.
- Wie hoort wat, wanneer: niemand wordt gewekt. Het werk wordt alleen vindbaar binnen de gekozen kring.
- Rollen en toestemming: alleen de maker. Een kind kan maximaal tot `team`. Geen `EXECUTE_LOW_RISK`.
- Uitzonderingen: `publiek` blijft zonder deur tot er een apart besluit is.
- Acceptatiecriterium: Gegeven werk in `alleenIk`, wanneer de maker `gezin` kiest en de bevestiging afbreekt, dan staat het werk nog in `alleenIk` en is er geen regel `aangeboden`.

**CON-12 Meelezen door wie een rechtmatige verhouding heeft (ouder van een kind onder de 16)** · L3 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: de band uit `apps/foundation/mijnbanden.html` (`rtf.wie-mag-zien`). Connect leest die band als woord en zoekt hem niet zelf op (`kring.js`: "wat hier niet woont").
- Regels en rekenwijze: alleen-lezen, één dossier per verzoek, nooit naast een ander dossier.
- Onzekerheid: wanneer een verhouding "rechtmatig" is, is een besluit (onder de 16 de ouder via de UAVG; daarboven het kind zelf).
- Wie hoort wat, wanneer: het kind ziet wie meekijkt.
- Rollen en toestemming: geen tweede rechtenmodel; de bestaande band beslist.
- Uitzonderingen: de beschermingsdeur gaat voor. Bij een beschermzaak kijkt niemand mee buiten de keten van HDI.md.
- Acceptatiecriterium: Gegeven een kind van 12 met een band naar de ouder, wanneer de ouder het dossier opent, dan ziet hij alleen dat ene dossier, alleen-lezen, en ziet het kind in zijn eigen scherm dat de ouder meekijkt.

**CON-13 Teamkring voor een schoolproject** · L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: het team bestaat in `apps/foundation/projecten.html` (`leren.project`). Connect krijgt alleen de relatie "team" als woord.
- Regels en rekenwijze: een team is begrensd in tijd en aantal (`kring.js`).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: teamleden zien het werk zolang het project loopt.
- Rollen en toestemming: het project bepaalt wie lid is.
- Uitzonderingen: als het project eindigt, vervalt de relatie, en het werk valt terug naar de kring die nog geldig is.
- Acceptatiecriterium: Gegeven een afgesloten project, wanneer een oud-teamlid het werk opvraagt, dan krijgt hij "dicht" en de maker houdt zijn werk.

**CON-14 Portfolio meenemen (export en deelbare momentopname)** · L5 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: het portfolio en `RTGUitvoer` (`/shared/uitvoer.js`, nu al gebruikt in Schrift).
- Regels en rekenwijze: alleen eigenDoen en overdracht, met `stelt` en `nietZegt` per regel en zonder getal.
- Onzekerheid: de graad reist mee.
- Wie hoort wat, wanneer: de mens zelf bepaalt wie het bestand krijgt; RTG verstuurt niets.
- Rollen en toestemming: een kind exporteert naar het gezin. Een volwassene exporteert vrij.
- Uitzonderingen: regels met de aanspraak "geen" verlaten het huis nooit.
- Acceptatiecriterium: Gegeven een portfolio, wanneer de mens op "Meenemen" tikt, dan krijgt hij een bestand met per regel onderwerp, trede, graad, `stelt` en `nietZegt`, zonder totaalregel.

**CON-15 Werk intrekken en de gevolgen zien** · L5 · half · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `lus.zonder()` bestaat. Het intrekken zelf hoort bij het domein dat het werk bezit.
- Regels en rekenwijze: valt `maak` weg, dan vallen `deel`, `help` en `verbind` mee. Dossierregels blijven staan, want ze leggen een gebeurtenis vast.
- Onzekerheid: wat al gekopieerd is, valt niet terug te halen; het scherm zegt dat.
- Wie hoort wat, wanneer: de maker.
- Rollen en toestemming: alleen de maker.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven ingetrokken werk, wanneer iemand er een naklank op wil geven, dan krijgt hij een weigering met reden en wordt er niets geteld.

**CON-16 De overgang naar 18 en de overdracht van het dossier** · L5 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: het dossier hangt aan `rtf:CODE:profiel`. Een eigen account heeft een andere sleutel.
- Regels en rekenwijze: de jongere neemt zijn dossier zelf over naar zijn eigen account, met één bevestiging. Het gezinsprofiel houdt dan niets meer.
- Onzekerheid: de leeftijd kan door het lid zijn opgegeven (`leeftijdBron`, AGENTS.md).
- Wie hoort wat, wanneer: de ouder krijgt bericht dat meelezen stopt.
- Rollen en toestemming: alleen de jongere. Een ouder kan de overdracht niet tegenhouden.
- Uitzonderingen: hangt er een beschermzaak aan, dan gaat de keten van HDI.md voor.
- Acceptatiecriterium: Gegeven een 18-jarige met een gezinsprofiel en een eigen account, wanneer hij overdraagt, dan staat zijn dossier onder zijn account en geeft de gezinsdeur voor dat profiel een leeg dossier met de reden.

**CON-17 Bewaartermijn en wissen van het eigen dossier** · L5 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `opslag.js` (drie collecties). Er is alleen de noodrem `MAX`.
- Regels en rekenwijze: de mens wist per regel of alles. Regels van een ander ("gebruikt") wist hij alleen bij zichzelf.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: alleen de eigenaar. Voor een kind onder de 16 wist ook de ouder (twijfel: aan de integrator voorleggen; UAVG).
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een dossier met 5 regels, wanneer de mens alles wist, dan geeft het dossier 0 regels terug en vindt de opslaglezer het onderwerp niet meer.

**CON-18 Motor "menselijk": werk van een vakmens uit het mediaregister** · L2 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: een bron op de mediacatalogus en niet op het herkomstregister (CONNECT.md par. 9.2).
- Regels en rekenwijze: geen ranglijst van makers en geen bereik als sorteersleutel.
- Onzekerheid: dat iemand vakkennis heeft, is `vermoed`, tenzij een bestaand genre het bewijst.
- Wie hoort wat, wanneer: de maker hoort alleen naklanken.
- Rollen en toestemming: alleen werk in de kring `community` of hoger.
- Uitzonderingen: werk van een kind komt nooit in deze motor.
- Acceptatiecriterium: Gegeven werk in `community`, wanneer het via "menselijk" in de lijst staat, dan zegt de reden waarom, zonder volgersaantal.

**CON-19 Motoren "brug", "actualiteit" en "toeval"** · L4 · ontbreekt · kosten groot · complexiteit hoog · aanbevolen later
- Gegevens en bron: brug zou mensen voorstellen, en dat raakt de grens "geen lijst mensen" (`routes/connect.js`). Actualiteit vraagt een nieuwsbron.
- Regels en rekenwijze: brug alleen als een onderwerp-naar-onderwerp-brug (zoals bruggen.js) en nooit mens-naar-mens zonder besluit.
- Onzekerheid: hoog.
- Wie hoort wat, wanneer: n.v.t.
- Rollen en toestemming: eigenaarsbesluit nodig voor mens-naar-mens.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven het motorenoverzicht, wanneer een motor niet is aangesloten, dan meldt hij dat met reden en gaan zijn plekken zichtbaar naar de andere kant.

**CON-20 De graad van een brug meten (brug leidt tot "geprobeerd")** · L4 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: een aggregaat over naklanken per brug, nooit per mens.
- Regels en rekenwijze: de graad gaat pas omhoog als de meting wordt genoemd (`bruggen.js`).
- Onzekerheid: een kleine n blijft `vermoed`.
- Wie hoort wat, wanneer: de redactie van de bruggenlijst.
- Rollen en toestemming: alleen geaggregeerd.
- Uitzonderingen: niet gemeten is geen nul.
- Acceptatiecriterium: Gegeven een brug zonder meting, wanneer hij getoond wordt, dan staat er graad `vermoed` en geen percentage.

**CON-21 Leerstof uit de leerlijn van School als bron** · L6 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `bron-leerstof.js` leest `kern/leerstof` (166 leerdoelen over 26 vakken volgens de kop van `bron-leerstof.js`; niet nageteld). De ingang verwijst naar `apps/rtgschool.html` (`leren.school`).
- Regels en rekenwijze: alleen een verwijzing (`ingang` is een pad), geen kopie.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: School hoort pas iets als de mens daar zelf iets doet.
- Rollen en toestemming: geen nieuwe.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een leerstofplek, wanneer de mens op Bekijken tikt, dan opent de leerstof in School en schrijft Connect alleen "gezien".

**CON-22 Werk uit Schrift of Bord als "gemaakt"** · L6 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: Schrift zou `nieuwWerk()` moeten aanroepen, maar een leerling in een les heeft geen codenaam (`toegang.js`: "een kind is geen profiel").
- Regels en rekenwijze: alleen als de leerling meedoet als gezinsprofiel of met een account, en zelf bevestigt.
- Onzekerheid: dat het werk af is, wordt niet gesteld.
- Wie hoort wat, wanneer: alleen de leerling.
- Rollen en toestemming: de begeleider kan niets in het dossier zetten.
- Uitzonderingen: een anonieme lesdeelname levert niets op.
- Acceptatiecriterium: Gegeven een kindprofiel dat een tekening in zijn schrift bewaart en "zet in mijn dossier" bevestigt, dan staat er "gemaakt" met de bron `schrift:<les>:<blad>` en bij de begeleider niets.

**CON-23 Projectie van het portfolio in de levensgraaf (alleen de eigen knoop)** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: `kern/levensgraaf/bronnen-leven.js` leest de leerlaag (`db.data.leren`) al, maar niet Connect.
- Regels en rekenwijze: een projectie met een verwijzing naar het portfolio, geen kopie. De kring van de knoop volgt de kring van het dossier.
- Onzekerheid: de graad reist mee.
- Wie hoort wat, wanneer: alleen de mens zelf.
- Rollen en toestemming: de levensgraaf (`KRING`) beslist.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een portfolio met 2 regels, wanneer de levensgraaf van de mens wordt geladen, dan staat er één knoop "leerdossier" met een link en geen inhoud.

**CON-24 Streaks, badges, makerranglijst, volgers** · — · aanbevolen niet doen
- Reden: dit is verboden door AGENTS.md en door `NIET_GEBOUWD` (beloon, rangschik), en het is een cijfer op een mens.

**CON-25 Personalisatie op kijktijd, tijdstip of locatie** · — · aanbevolen niet doen
- Reden: bij naam geweigerd in `GEEN_SIGNAAL`; dat is een aandachtsmachine.

**CON-26 Publiek voor een profiel onder de 18, ook met toestemming van de ouder** · — · aanbevolen niet doen
- Reden: publiek is onomkeerbaar, en niemand neemt dat besluit namens een kind (`kring.js`).

### e. RTG-exclusief

1. **Leren dat telt omdat een ander mens het bevestigt, zonder aandachtsscore.** De keten: een lid maakt een clip (eigenaar: `kern/clips.js`, mediaos), de werkherkomst legt de maker vast (`kern/mediaos/werkherkomst.js`), een kind probeert het en geeft "geprobeerd" (Connect, naklank), en bij de maker ontstaat de regel "gebruikt" met de graad `bewezen` (Connect, dossier). De maker ziet zes aparte aantallen en geen namen. Er wordt geen gegeven gedeeld; alleen het werk-id reist mee.
2. **Van buurtposter naar meedoen.** `rtfos/publiek` (eigenaar: RTFoundation-stad, `wereld.foundation`) levert een plek. De mens opent `apps/foundation/meedoen-ontdekken.html` (`rtf.meedoen`) en vraagt daar zelf meedoen aan, met één bevestiging. Connect schrijft alleen "gezien".
3. **Een kind ontdekt veilig, binnen het gezin.** Gezinsprofiel (eigenaar: `gezin.beheer`) → beschermd-vlag in de sessie → de kring stopt bij `team` → het dossier hangt aan de codenaam → bij nood geldt de beschermingsdeur (HDI.md par. 7; `rtf.hulpwijzer`, `rtf.onveilig`). Geen ander platform heeft deze grens als code en niet als instelling.
4. **Bewijs dat het huis verlaat zonder score.** Portfolio (Connect) → meenemen (CON-14) → cv (`apps/foundation/cv.html`, `werk.cvmaker`) door verwijzing. De cv-maker toont het bewijsstuk met `nietZegt`.

### f. Bouwstenen en ontbrekende koppelingen

**Wat er staat:** `server/kern/connect/*.js` (20 bestanden), `server/routes/connect.js`, `server/routes/connect-gezinsdeur.js`, `public/apps/connect.html`, `scripts/lib/voltooi/connect.js`, `scripts/lusproef.js`, de bedrading in `server/opzet/kernlaag7-ruimtes.js`, en de toetsen `test/connect*.test.js`, `test/connect-*.e2e.js`.

**Wat ontbreekt, per koppeling:**

| van → naar | vorm | wat |
|---|---|---|
| Connect → mediaos | verwijzing (werk-id) | de kring bewaren bij het werk (CON-07, CON-11) |
| Connect → `rtf.wie-mag-zien` | relatie als woord | meelezen (CON-12) |
| Connect → `leren.project` | relatie "team" | teamkring (CON-13) |
| Connect → levensgraaf | projectie | CON-23 |
| Schrift → mediaos → Connect | verwijzing (`nieuwWerk`) | CON-22 |
| Connect → `werk.cvmaker` | verwijzing naar portfolio-export | CON-14 |
| dossier → mixer (groei) | interne bron | CON-08 |
| scherm → naklank en kring | UI | CON-06, CON-07 |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| CON-01 t/m 05 | onderhouden | klein | laag | APPWERKT bedienbaar en menselijk bewijzen |
| CON-06 naklank op scherm | nu | klein | laag | gezinsroutes voor `weg` en `tel` |
| CON-08 motor groei | nu | klein | laag | geen |
| CON-14 portfolio meenemen | nu | klein | laag | `RTGUitvoer` |
| CON-17 wissen | nu | klein | midden | UAVG-besluit voor kind onder 16 |
| CON-21 leerstof naar School | nu | klein | laag | geen |
| CON-07 kring bij het werk | nu | middel | midden | mediaos neemt het veld op |
| CON-11 aanbieden met bevestiging | nu | middel | midden | CON-07 |
| CON-15 intrekken | nu | klein | midden | mediaos-intrekking |
| CON-09 lokaal met label | later | middel | midden | besluit over betaald aanbod |
| CON-12 meelezen | later | middel | hoog | `rtf.wie-mag-zien`, juridisch (UAVG) |
| CON-13 teamkring | later | middel | midden | `leren.project` |
| CON-16 overgang naar 18 | later | middel | hoog | accountkoppeling, `leeftijdBron` |
| CON-18 menselijk | later | middel | midden | bron op de mediacatalogus (CONNECT.md par. 9.2) |
| CON-19 overige motoren | later | groot | hoog | eigenaarsbesluit (brug) |
| CON-20 brugmeting | later | middel | midden | CON-06 in gebruik |
| CON-22 schriftwerk | later | middel | hoog | SCH-14 |
| CON-23 levensgraaf | later | klein | midden | graaf.js `KRING` |
| CON-10 challenges | niet doen vóór besluit | — | — | CONNECT.md par. 9.5 |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **"de lus is rond op het scherm"**: CON-06, CON-07, CON-08, CON-11, CON-14, CON-15, CON-17 en CON-21. Er komt geen nieuwe motor of laag bij. De motor groei is een vierde bron in de bestaande mixer. De kring wordt een veld bij het werk in mediaos, dus een verwijzing. Export loopt via `RTGUitvoer`.

Wat de gebruiker daarna kan dat hij nu niet kan:
- waardering geven en terugnemen op het scherm, ook als kind;
- eigen werk binnen het gezin of team aanbieden, met één bevestiging;
- een vervolg zien op wat hij zelf deed;
- zijn portfolio als bestand meenemen;
- zijn dossier wissen;
- werk intrekken en zien wat daardoor wegvalt.

### Uitkomst B — het domeinmaximum

Connect als **open-leernetwerk van Nederland zonder aandachtseconomie**: elke bibliotheek, elk buurthuis, elke club en elke vakmens kan iets klaarzetten, en elk bewijs van leren is draagbaar.

Nieuwe professionele processen:

1. **Bibliothecaris of jongerenwerker als curator** (rol: curator; organisatie: bibliotheek of welzijnsorganisatie). Het proces: een thema voorstellen, bruggen en leerstof verbinden, een activiteit in de buurt koppelen, publiceren in `community`, en na afloop een geaggregeerde terugblik (hoeveel "geprobeerd"; nooit per kind). Nodig: **eigenaarsbesluit nieuw genre** (bibliotheek/welzijn, niet in `genres-lijst`), een organisatieaccount, en een verwerkersovereenkomst met de organisatie.
2. **Vakmens-mentor** (rol: mentor; genre: een bestaand vakgenre waarvan het vakbewijs de vakkennis aantoont). Het proces: werk aanbieden, de vraag van een leerling ontvangen (verbind/help, één bevestiging per contact), en het geholpen-zijn wordt alleen door de leerling bevestigd. Nodig: **eigenaarsbesluit** over mens-naar-mens-verbinding (raakt de grens "geen lijst mensen"), een persoonseis VOG voor contact met minderjarigen (bij het wetsvoorstel VOG aanvullend onderwijs, zie BRD c), en een berichtkanaal via `rtf.bericht`.
3. **Gemeentelijke cultuur- en sporteducatie** (rol: gemeente, alleen geaggregeerd; LEVEN 2.6). Het proces: aanbod plaatsen met een label, en geaggregeerd per wijk terugzien hoeveel ontdekkingen tot "geprobeerd" leidden. Nodig: **eigenaarsbesluit** voor betaald of gesubsidieerd aanbod met label (CONNECT.md par. 9.5), en een externe aansluiting op het gemeentelijk activiteitenaanbod (extern, verwerkersovereenkomst).
4. **Erkenning van leerbewijs** (rol: werkgever of opleider als ontvanger). Het proces: de mens deelt een portfolio-momentopname, de ontvanger ziet `stelt`, `nietZegt` en de graad, en kan zelf "gebruikt" bevestigen. Nodig: **eigenaarsbesluit** over een open-badges- of credentialformaat (nieuwe externe koppeling) en een besluit dat `publiek` voor volwassenen een eigen bevestigingsstroom krijgt.
5. **Live ontdeksessies en vertaling** (CONNECT.md par. 7: "jaren weg"). Nodig: een **besluit** over een nieuwe motor of livelaag.

De huisregels blijven ook voor B gelden: geen ranglijst van makers, geen progressie onder 18, publiek nooit voor een kind, en bevestigen doet de mens.

### Ketens LOS en SAMEN

**LOS.** Als mediaos, rtfos en livingWorld uit staan, blijft de kerntaak: leerstof ontdekken (motor interesse en nieuwsgierig), openen, zelf noteren en het eigen dossier lezen. Het scherm zegt dan eerlijk:
- bij de motoren: "Deze motor is beschreven maar heeft nog geen bron";
- bij de buurt: "Deze motor kon niet kijken: …" of "keek en vond niets";
- bij een naklank: "dit huis weet niet van wie dit werk is", zodat er geen regel bij de maker ontstaat;
- bij werk erbij: "niets nieuws", met de uitleg.

**SAMEN, de keten "een kind probeert het werk van een lid":**
1. Een lid maakt een clip (`/api/clips/maak`; eigenaar: Clips/MediaOS).
2. `nieuwWerk` legt de maker vast (eigenaar: `kern/mediaos/werkherkomst.js`).
3. Het lid haalt zijn werk erbij en krijgt "gemaakt" en "aangeboden" (Connect, `werkbij.js`).
4. Een kind opent de ontdekking en krijgt "gezien" in zijn eigen dossier (Connect, gezinsdeur; gezinsprofiel van `gezin.beheer`).
5. Het kind geeft "geprobeerd" (Connect, naklank).
6. De maker krijgt "gebruikt" met graad `bewezen` (Connect, dossier via `bijOverdracht`).
7. De maker ziet de zes aantallen (Connect, `naklank/tel`).

**Storingen:**
- **Werkherkomst valt uit (stap 2/6):** de naklank wordt geteld, `dossierReden` zegt "dit huis weet niet van wie dit werk is", en de maker krijgt geen regel. Het kind ziet dat zijn naklank is gegeven.
- **De gezinssessie is verlopen (stap 4):** 403 "Log opnieuw in bij je gezin."
- **Een gast probeert het:** 403 met uitleg dat er bij een gastprofiel niets bewaard wordt.
- **Dubbele tik (stap 5):** idempotent; er komt één regel bij.
- **De server crasht na noteren:** de regel blijft staan (voltooiproef herstelbaar).
- **Een kind wil zijn werk publiek maken (variant):** weigering met reden. Versmallen blijft mogelijk.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | meting |
|---|---|---|
| breedte | ten minste 4 van de 8 motoren aangesloten, en elke niet-aangesloten motor meldt dat met reden | `motoren()` in de voltooiproef |
| professionele diepte | lokaal aanbod draagt altijd een aanbiederlabel, en betaald aanbod komt niet in de lijst zonder besluit | voltooistap "lokaal met label" |
| levenscyclus | ontstaan, aanbieden (met bevestiging), intrekken, meenemen, wissen en overdracht naar 18 zijn elk één voltooistap | `scripts/lib/voltooi/connect.js`, uitgebreid |
| samenwerking en rollen | de ouder van een kind onder de 16 leest alleen-lezen, het kind ziet dat, en geen route leest twee dossiers | BEVOEGD-kruisparen en IDOR "gescheiden" in plaats van "onbereikbaar" |
| domeinintelligentie | elke plek heeft een reden; geen graad boven `vermoed` zonder genoemde meting | schemacontrole op het antwoord |
| los functioneren | met mediaos en rtfos uit sluit de kernlus (ontdek, open, noteer, dossier) | voltooiproef met uitgeschakelde bronnen |
| RTG-ketens | de lusproef (17 schakels) blijft groen, plus de keten "aanbieden → gezin ziet het" | `npm run lusproef` |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN; IDOR: 0 routes "onbereikbaar" voor het eigen-dossierpad | APPWERKT.json, IDOR.json |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | geen dubbele logica: Connect alleen… |
|---|---|---|
| wie hoort bij wiens gezin of band | `apps/foundation/mijnbanden.html`, `rtf.wie-mag-zien`; `apps/foundation/beheer.html`, `gezin.beheer` | krijgt de relatie als woord |
| samen aan een project werken (Samen) | `apps/foundation/projecten.html`, `leren.project` | verwijst; de teamrelatie komt daarvandaan |
| leerlijn, oefenen, examens | `apps/rtgschool.html`, `leren.school` | verwijst met `ingang` |
| meedoen aan een activiteit in de stad | `apps/foundation/meedoen-ontdekken.html`, `rtf.meedoen` | toont de posterveilige plek en verwijst |
| contact met een mens (verbind/help) | `apps/foundation/vrienden.html`, `rtf.contacten`; `apps/foundation/mail.html`, `rtf.bericht` | verwijst; Connect heeft geen chat |
| cv met bewijs | `apps/foundation/cv.html`, `werk.cvmaker` | levert alleen een export |
| hulp bij nood (beschermingsdeur) | `apps/foundation/hulpwijzer.html`, `rtf.hulpwijzer`; `apps/foundation/onveilig.html`, `rtf.onveilig` | verwijst. `connect.html` laadt `/shared/uitstap.js` vandaag niet; twijfel: aan de integrator voorleggen of de uitstapknop op dit scherm hoort |
| wat er bewaard wordt (privacyuitleg) | `apps/foundation/privacy.html`, `rtf.privacy-uitleg` | verwijst |
| media maken | twijfel: aan de integrator voorleggen (Clips/MediaOS staat niet als scherm in mijn opdracht) | consumeert auteurschap, stelt het niet vast |

---


---

## 6. RTF Buurt — `link:rtfbuurt`, `/apps/foundation/os-publiek.html`

RTF Buurt is de buurtkant van de RTFoundation: wie in een stad woont, ziet welke RTF-afdeling open is, wat er loopt (projectnaam, soort, doelgroep), waar hij binnen kan lopen (open activiteiten met datum, tijd, plek en vrije plekken), welke landelijke campagne er loopt, en hoe hij meedoet als hulpvrager, vrijwilliger of ondernemer. De maat van de app staat in `server/kern/rtfos/publiek.js`: alles wat je niet op een poster in het buurthuis zou hangen, komt er niet uit. Er staat dus geen getal over hulpvragen in, geen naam van een vrijwilliger of hulpverlener, geen bedrag per project, geen project in de aanvraagfase en geen teller van wat een campagne opbracht. Sinds het eigenaarsbesluit van 19 oktober 2026 vraagt de app een account (een gratis account is genoeg) of een gezinsprofiel dat aan het account van een ouder hangt (`server/kern/elkesessie.js`). De kern is: de buurt laten zien waar ze kan aansluiten, zonder dat de buurt over zichzelf iets leert wat een etiket wordt.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | afgeleid (3 stappen) | de proef leidt menselijk af uit de herstelstappen; geen eigen menselijke meting |
| voltooibaar | GEEN_FIXTURE | gesloten, 7 stappen | `scripts/lib/voltooi/rtfbuurt.js`: steden, stad, campagne, stad in verkenning, 401 zonder account, geen interne velden, gestopt project verdwijnt |
| waarheidsgetrouw | BEWEZEN | — | |
| persistent | GEEN_FIXTURE | gesloten, 3 stappen | herstart, read-only opslaglezer, tweede ouder ziet hetzelfde |
| bevoegd | BEWEZEN | — | BEVOEGD.json: 1/1 kruisparen gescheiden |
| herstelbaar | GEEN_FIXTURE | gesloten, 3 stappen | dubbele tik, afgebroken verzoek, crash (SIGKILL): zelfde beeld, opslag onaangeroerd |
| IDOR | — | — | niet gemeten (IDOR.json, 05:05) |

Wat de code doet (gelezen in de repo):
- **Routes** (`server/routes/rtfos/doelgroepen.js`): `POST /api/rtfos/publiek/steden`, `/publiek/stad`, `/publiek/campagnes`. Elk met een bronrem van 120 per minuut per IP (`leesRem`) en de vraag `magSessie(req, { resolveSession, rtf })`; zonder sessie 401 met `{ error: 'Niet ingelogd.', accountNodig: true }`. De vraag zit in de handler en niet in middleware, zodat de bewakerskaart (`scripts/lib/bewakers.js`) de deur niet als lek telt (`server/kern/elkesessie.js`).
- **`magSessie`** laat door: een bearer-token dat `resolveSession` kent met een `account` of een `role` (lid, zaak, kantoor), in de testomgeving ook een persona; of een gezinsprofiel met `code` en `token` in het lijf dat `rtf.verifieerProfiel` goedkeurt.
- **`publiek.steden()`**: alleen steden met status `actief`, per stad de soorten werk van actieve projecten (geen aantallen).
- **`publiek.stad(id)`**: 404 met "nog niet open" voor een stad die niet actief is; projecten met status `actief` (naam, soort, doelgroep, van, tot); activiteiten met status `open` of `vol` en een datum vanaf vandaag, met `plekVrij` geteld uit inschrijvingen met status `ingeschreven` of `aanwezig`; drie vaste meedoen-teksten (hulp, vrijwilliger met VOG die RTF betaalt, ondernemer).
- **`publiek.campagnes()`**: campagnes met status `live`, met naam, doel, looptijd en de steden uit de verdeelsleutel, zonder bedrag.
- **Scherm** (`public/apps/foundation/os-publiek.html`): stadkiezer, vier "wat kun je doen"-kaarten die naar een blok op dezelfde pagina springen (geen vierde ingang), een `?stad=`-slug die alleen geldt als hij overeenkomt met een stad uit de publieke lijst, een bewaarde stad per browser, links naar `os-vrijwilliger.html` en `os-deelnemer.html`, en het wereldrooster van FoundationOS.
- **Bevindingen bij het lezen** (geen oordeel over de proef, wel over de stand):
  1. Het scherm heeft geen accountdeur. `RTGAccountDeur` komt in `os-publiek.html` niet voor; zonder sessie ziet de bezoeker in het stedenblok alleen de foutzin "Niet ingelogd." en geen weg naar registreren. `os-portaal.html` heeft die deur wel.
  2. Drie teksten zijn achterhaald door het accountbesluit: `SCHERMEIGENAAR.json` (scherm `apps/foundation/os-publiek.html`, doel "Zonder in te loggen zien wat..."), de kop van `server/kern/rtfos/publiek.js` ("GEEN CODE, GEEN INLOG") en de scriptkop en de functie `groet()` in `os-publiek.html` ("geen inlog", "deze pagina heeft er geen").
  3. Inschrijven op een activiteit kan alleen via het kantoor: `server/kern/rtfos/activiteiten-deur.js` gaat door `poortIn(w, a.stad, 'project.beheren', 'events')`. De buurt ziet "12 plekken vrij" maar kan er zelf niet een nemen.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Nextdoor for Public Agencies | één agency-programma; geen duurder pakket gevonden | gratis voor overheden en (in Australië) voor publieke diensten en non-profit buurtorganisaties | geverifieerde agency-accounts, noodmeldingen naar buurten of zelfgekozen gebieden, "Forward to Police" (alleen politie), alleen VS voor de app uit 2020 | Nextdoor Public Agency — https://business.nextdoor.com/en-us/public-agency (zoekresultaat 2026-10-19, pagina niet geopend); Nextdoor persbericht — https://about.nextdoor.com/press-releases/product-news/nextdoor-announces-new-app-for-public-agencies (zoekresultaat 2026-10-19, pagina niet geopend); Nextdoor Public Services FAQ — https://business.nextdoor.com/en-au/publicservices-faq (zoekresultaat 2026-10-19, pagina niet geopend) |
| Hoplr (gemeenten) | gemeentecontract; geen prijslijst gevonden | geen gegevens (gratis en reclamevrij voor bewoners volgens gemeentepagina's) | buurtnetwerk, lokale communicatie, consultatierondes, buurtinitiatieven, besluitvormingsinstrumenten | Hoplr gemeenten — https://services.hoplr.com/ (eerder zoekresultaat 2026-10-19, pagina niet geopend); Hoplr NL — https://services.hoplr.com/nl (zoekresultaat 2026-10-19, pagina niet geopend); Nederweert raadsinformatie — https://nederweert.bestuurlijkeinformatie.nl/Document/View/021b7b3e-be3c-41c3-b9ae-75c1b1c85261 (zoekresultaat 2026-10-19, pagina niet geopend) |
| Decidim | open source; geen betaald pakket, wel dienstverleners | geen licentiekosten volgens een directory; hostingkosten geen gegevens | participatieve begroting in fasen met stemregels, voorstellen, publieke uitslagen | Decidim — https://decidim.org/features/ (eerder zoekresultaat 2026-10-19, pagina niet geopend); FitGap Decidim — https://us.fitgap.com/products/decidim (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:
- Overzicht wat er in de buurt loopt: **ja** (soorten werk, projecten, open activiteiten).
- Vrije plekken bij een activiteit: **ja** (`plekVrij`, geteld).
- Zelf aanmelden voor een activiteit: **nee** (alleen via het kantoor).
- Geverifieerde afzender (de stad is echt RTF): **half** (alleen actieve steden verschijnen; er is geen zichtbaar "erkend door"-teken van partners).
- Noodmeldingen naar een buurt: **nee**, en dat hoort ook niet hier (zie c: geen engagementpatroon, en meldingen horen bij de gemeente of de berichtenapp).
- Participatie en stemmen: **nee in deze app**; dat is `democratie.kwestie` (`apps/foundation/kwesties.html`) en het Klimaatfonds.
- Buurtgesprek of prikbord: **nee in deze app**; dat is `ontdekken.connect` (`apps/connect.html`) en het prikbord van het genootschap.
- Gratis voor de bewoner: **ja** (gratis account).

### c. Het volledige domein

**Hoe mensen hier echt werken.**
- *Particulier.* Een bewoner zoekt iets laagdrempeligs: een taalcafé, een buurtmaaltijd, een huiswerkklas, een plek om binnen te lopen. Hij wil weten wanneer, waar, of het gratis is, of er plek is en of hij iemand mee mag nemen. Wie hulp nodig heeft, zoekt eerst anoniem en wil niet dat de buurt het ziet. Een ouder kijkt voor zijn kind en wil weten of begeleiders gescreend zijn.
- *Professioneel.* Opbouwwerkers, wijkteams en welzijnsorganisaties werken met een sociale kaart (wie biedt wat in de wijk), met inloopspreekuren en met doorverwijzing naar het sociaal wijkteam of het Wmo-loket van de gemeente. Vrijwilligers met kinderen of mensen in een afhankelijke positie werken met een VOG; voor non-profitorganisaties met zulke vrijwilligers bestaat de regeling Gratis VOG (toelating via CIBG, screening door Justis, eHerkenning niveau 2+ voor de organisatie en DigiD voor de vrijwilliger, een gepubliceerd preventie- en integriteitsbeleid, KvK-inschrijving; bron: SRA-nieuwsbank — https://www.sra.nl/nieuws/004501/2022/10/gratis-vog-voor-vrijwilligersorganisaties en NOC*NSF FAQ — https://nocnsf.nl/media/1jylmlyx/vog-en-regeling-gratis-vog-veelgestelde-vragen.pdf, beide zoekresultaat 2026-10-19, pagina niet geopend; de bronnen dateren van 2016 tot 2022).
- *Organisatorisch.* Gemeenten sluiten vaak collectief de VNG Vrijwilligersverzekering bij Centraal Beheer; vrijwilligers hoeven zich niet aan te melden, en schade loopt via de gemeente (bron: gemeente Groningen brochure — https://gemeente.groningen.nl/file/brochure-vrijwilligersverzekering en Montferland folder — https://www.montferland.info/sites/default/files/2023-01/Folder%20vrijwilligersverzekering%20juni%202022.pdf, beide zoekresultaat 2026-10-19, pagina niet geopend). Of een gemeente dat doet, verschilt per gemeente.

**Regels en kaders.**
- Wmo 2015: de gemeente is verantwoordelijk voor maatschappelijke ondersteuning en de toegang ertoe; een buurtinitiatief kan een algemene voorziening aanvullen, niet de toegang vervangen. Artikelnummers: geen gegevens.
- AVG en UAVG: wie in een openbaar scherm zichtbaar maakt wie waar aan deelneemt, verwerkt gevoelige gegevens (deelname aan een schuldhulpcafé zegt iets over iemands financiële situatie). Daarom geen deelnemersgegevens in het publieke deel.
- LEVEN.md par. 2.6: inzichten alleen op groepen die groot genoeg zijn, nooit op een groep die tot een wijk te herleiden is. Voor de straat betekent dat: geen enkel hulpvraaggetal (zo staat het ook in `publiek.js`).
- Merkregels (AGENTS.md): geen kunstmatige urgentie, geen thermometer.

**Wat daaruit volgt voor de app.**
1. Praktische info per activiteit (kosten, toegankelijkheid, taal, mag een kind alleen komen) is wat een bewoner nodig heeft om echt binnen te lopen; die velden bestaan nog niet.
2. Zelf inschrijven hoort erbij, maar op codenaam, met één menselijke bevestiging, en voor een kind via de ouder.
3. Het vrijwilligersaanbod per stad moet de VOG-eis en de verzekering eerlijk noemen (wie betaalt, wie is verzekerd: "geregeld door de gemeente" alleen als dat is vastgelegd).
4. Doorverwijzen naar professionele hulp is verwijzen, geen intake: de buurt-app opent de Hulpwijzer of het gemeenteloket, en legt niets vast.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** sterk in lezen, zwak in handelen: je ziet een open plek maar kunt hem niet nemen.
- **L2 Professioneel (bestaande genres):** de app toont geen professional, en zo hoort het; de verdieping is eerlijke VOG- en verzekeringsinformatie bij vrijwilligerswerk en een verwijzing naar de bestaande hulpingangen.
- **L3 Organisatorisch:** de stadsstatus en de grens van het kantoor werken; wat ontbreekt is zichtbaarheid van erkende partners en een vaste buurtenlijst.
- **L4 Domeinintelligentie:** bijna afwezig, en dat mag: alleen een toevoegende, zelfgekozen suggestie past hier; geen voorspelling als feit.
- **L5 Volledige levenscyclus:** de app stopt bij "er is plek"; inschrijven, herinneren, afmelden, wachtlijst en terugblik ontbreken aan de bewonerskant.
- **L6 RTG-samenhang:** alleen links naar vrijwilliger- en deelnemerportaal en het wereldrooster; agenda, navigatie en levensgraaf zijn niet verbonden.

**BRT-01 Stedenoverzicht** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `S().steden` met status `actief`; soorten uit actieve projecten (`kern/rtfos/publiek.js` `steden()`).
- Regels en rekenwijze: alleen status `actief`; soorten zijn een unieke, gesorteerde lijst; geen aantallen.
- Onzekerheid: geen; een stad zonder actief project toont een lege soortenlijst.
- Wie hoort wat, wanneer: elke ingelogde bewoner, op het moment van openen.
- Rollen en toestemming: account of gezinsprofiel (`magSessie`).
- Uitzonderingen: verkend, in oprichting of geblokkeerd: niet in de lijst.
- Acceptatiecriterium: Gegeven een actieve stad Zwolle met een taalproject en een stad Deventer in verkenning, wanneer een ingelogde ouder het overzicht opent, dan ziet hij Zwolle met "taal" en Deventer niet.

**BRT-02 Stadspagina met projecten en open activiteiten** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: projecten met status `actief`, activiteiten met status `open` of `vol` en datum vanaf vandaag; `plekVrij = capaciteit − (ingeschreven + aanwezig)`.
- Regels en rekenwijze: geen budget, projectleider, begeleider of inschrijving in het antwoord (toets in `rtfbuurt.js`).
- Onzekerheid: `plekVrij` is een momentopname; tussen lezen en binnenlopen kan hij veranderen.
- Wie hoort wat, wanneer: bewoner bij openen; een gestopt project verdwijnt meteen.
- Rollen en toestemming: account of gezinsprofiel.
- Uitzonderingen: stad niet actief: 404 met "nog niet open".
- Acceptatiecriterium: Gegeven een buurtmaaltijd met capaciteit 12 en geen inschrijvingen, wanneer de ouder de stad opent, dan ziet hij de maaltijd met datum, tijd, plek en 12 plekken vrij, en geen enkel veld met budget of begeleider.

**BRT-03 Landelijke campagnes zonder teller** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: campagnes met status `live`, steden uit de verdeelsleutel.
- Regels en rekenwijze: geen opgehaald bedrag, geen doelbedrag, geen thermometer (merkregel: geen kunstmatige urgentie).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: bewoner bij openen.
- Rollen en toestemming: account of gezinsprofiel. Doneren zelf is `geven.doneren` (`apps/foundation/geven.html`).
- Uitzonderingen: geen live campagne: lege lijst met tekst.
- Acceptatiecriterium: Gegeven een live campagne met verdeelsleutel 100% Zwolle, wanneer de bewoner de campagnes opent, dan ziet hij "Zwolle" en komt er in het antwoord geen woord als bedrag, euro, opgehaald of totaal voor.

**BRT-04 Meedoen-wegwijzer** · L2 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: drie vaste teksten in `publiek.stad()`; links naar `os-vrijwilliger.html` en `os-deelnemer.html`.
- Regels en rekenwijze: de VOG-tekst belooft "die regelen we samen en betalen wij"; dat is een belofte die het kantoor moet kunnen waarmaken.
- Onzekerheid: of RTF de Gratis VOG-regeling gebruikt of zelf betaalt, staat niet in de code.
- Wie hoort wat, wanneer: bewoner bij openen.
- Rollen en toestemming: account.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een open stad, wanneer de bewoner op "Doe mee" tikt, dan komt hij op het vrijwilligers- of deelnemersportaal, en een code die daar hoort, opent daar en niet in het buurtscherm.

**BRT-05 Accountdeur en eerlijke 401** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de bestaande `RTGAccountDeur` uit `os-portaal.html`; het veld `accountNodig: true` in het 401-antwoord.
- Regels en rekenwijze: zonder sessie toont het scherm waarom een account nodig is ("een gratis account is genoeg") en de weg naar `account.registratie` (`apps/foundation/registreren.html`), in plaats van de kale zin "Niet ingelogd.".
- Onzekerheid: geen.
- Wie hoort wat, wanneer: bezoeker zonder sessie, meteen.
- Rollen en toestemming: geen; registreren is de deur.
- Uitzonderingen: de beschermingsdeur (HDI.md par. 7) blijft zonder account open: het scherm noemt ook zonder sessie de weg naar `rtf.onveilig` (`apps/foundation/onveilig.html`).
- Acceptatiecriterium: Gegeven een bezoeker zonder sessie, wanneer hij het buurtscherm opent, dan ziet hij een uitleg en een knop naar registreren, plus de link "Onveilig? Hier kun je zonder account terecht", en geen ruwe foutzin.

**BRT-06 Zelf inschrijven op een open activiteit** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: de bestaande inschrijving in `kern/rtfos/activiteiten-deur.js` (op codenaam, wachtlijst bij vol, incheckcode van 128 bits, transactie op `rtfos`); nieuw is alleen een ledenroute die dezelfde functie aanroept.
- Regels en rekenwijze: klaarzetten en één bevestiging van de bewoner ("Inschrijven voor Buurtmaaltijd, dinsdag 18:00"); vol wordt wachtlijst met plaats; een kind alleen via het gezinsprofiel van de ouder, en de grendel bij het inchecken (toestemming ouder) blijft; fototoestemming apart en nooit afgeleid.
- Onzekerheid: dubbele inschrijving bij twee tikken; dat vangt de bestaande transactie.
- Wie hoort wat, wanneer: de bewoner krijgt zijn incheckcode één keer; de stad ziet een inschrijving op codenaam; niemand anders hoort iets.
- Rollen en toestemming: account (niveau van een gratis account); voor een kind de ouder.
- Uitzonderingen: activiteit met doelgroep die een etiket draagt (bv. schuldhulp): inschrijven gaat via de activiteit zelf of het deelnemersportaal, niet via het publieke scherm (besluit per activiteitsoort; twijfel: aan de integrator voorleggen).
- Acceptatiecriterium: Gegeven een buurtmaaltijd met 1 vrije plek, wanneer twee bewoners tegelijk bevestigen, dan heeft één een inschrijving en de ander plaats 1 op de wachtlijst, en ziet het publieke scherm 0 plekken vrij en "vol".

**BRT-07 Afmelden en wachtlijst aan de bewonerskant** · L5 · ontbreekt · kosten klein · complexiteit laag · later (na BRT-06)
- Gegevens en bron: `schuifOp` en de afmelding in `activiteiten-deur.js` (afmelden trekt de incheckcode in).
- Regels en rekenwijze: afmelden is één tik met bevestiging; de eerstvolgende op de wachtlijst hoort het via `comm.berichten` (`apps/comm.html`) als klaargezet bericht van de stad, geen automatische tweede-persoonsactie zonder bevestiging aan de stadskant.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de afmelder direct; de volgende op de lijst na bevestiging door de stad.
- Rollen en toestemming: alleen de eigen inschrijving.
- Uitzonderingen: afmelden na de start van de activiteit kan niet meer.
- Acceptatiecriterium: Gegeven een volle activiteit met één wachtende, wanneer de ingeschrevene zich afmeldt, dan is zijn code ongeldig en staat de wachtende klaar om door de stad te worden bevestigd.

**BRT-08 Praktische informatie per activiteit** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: nieuwe vrije velden op de activiteit (kosten: gratis of bedrag; rolstoeltoegankelijk ja/nee/onbekend; voertaal; leeftijd; "kind mag alleen komen" ja/nee), ingevuld door de stad.
- Regels en rekenwijze: "onbekend" staat er als onbekend, nooit als nee (huisregel: niet gemeten is geen nul).
- Onzekerheid: wat de stad invult; geen controle.
- Wie hoort wat, wanneer: bewoner bij openen.
- Rollen en toestemming: invullen met `project.beheren` in de stad.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een activiteit zonder ingevulde toegankelijkheid, wanneer de bewoner hem opent, dan staat er "toegankelijkheid: niet opgegeven" en niet "niet toegankelijk".

**BRT-09 Doorverwijzen naar professionele hulp** · L2 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: nu één vaste zin ("loop binnen bij een activiteit of vraag ernaar bij het buurthuis"). Nieuw: links naar `rtf.hulpwijzer` (`apps/foundation/hulpwijzer.html`), `hulp.wegwijzer` (`apps/foundation/wegwijzer.html`) en `overheid.gemeente-burger` (`apps/gemeente.html`) voor het Wmo-loket.
- Regels en rekenwijze: verwijzen, niet vastleggen; de buurt-app weet niet dat iemand doorklikte.
- Onzekerheid: of de gemeente van die stad in RTG een loket heeft; zo niet, dan zegt de link dat eerlijk.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: account.
- Uitzonderingen: acute onveiligheid: de beschermingsdeur zonder account (BRT-05).
- Acceptatiecriterium: Gegeven een bewoner op de stadspagina, wanneer hij "Hulp nodig" kiest, dan opent de Hulpwijzer of het gemeenteloket, en schrijft de RTF-opslag niets.

**BRT-10 Vrijwilligerswerk per stad met eerlijke VOG- en verzekeringsregel** · L2 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `VOG_VERPLICHT = ['jongeren','huiswerk','sport','ouderen']` in `kern/rtfos/vrijwilligers.js`; projectsoorten van actieve projecten; een nieuw stadsveld "vrijwilligersverzekering: gemeente/RTF/partner/niet vastgelegd".
- Regels en rekenwijze: per soort werk: "VOG vereist" als de soort in `VOG_VERPLICHT` staat; verzekering alleen als "geregeld door ..." als dat veld gevuld is, anders "niet vastgelegd, vraag het de stad".
- Onzekerheid: polisvoorwaarden verschillen per gemeente; de app noemt geen dekking.
- Wie hoort wat, wanneer: bewoner bij openen; aanmelden loopt via `werk.vrijwilligerswerk` (`apps/foundation/os-vrijwilliger.html`).
- Rollen en toestemming: account.
- Uitzonderingen: geen namen van coördinatoren.
- Acceptatiecriterium: Gegeven een actief huiswerkproject en een stad zonder vastgelegde verzekering, wanneer de bewoner vrijwilligerswerk bekijkt, dan staat er "VOG vereist" en "verzekering: niet vastgelegd", en geen bewering over dekking.

**BRT-11 Eerlijke stadsstatus** · L3 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: stadstatus; `publiek.stad()` geeft 404 "RTF <naam> is nog niet open".
- Regels en rekenwijze: geen datum van opening, geen belofte.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: bewoner bij openen of via `?stad=`.
- Rollen en toestemming: account.
- Uitzonderingen: een slug die niet in de publieke lijst staat: "Deze stadsafdeling staat niet openbaar".
- Acceptatiecriterium: Gegeven Deventer in verkenning, wanneer de bewoner `?stad=deventer` opent, dan ziet hij dat de afdeling niet openbaar is en geen enkel project.

**BRT-12 "Werkt samen met": erkende partners op posterniveau** · L3 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `partners.erkend()` in `kern/rtfos/partners-portaal.js` (geeft alleen id en naam bij status `goedgekeurd` of `actief` en niet dicht).
- Regels en rekenwijze: alleen naam en werkgebied (posterwaardig); nooit contactpersoon, KvK, IBAN of beoordeling.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: bewoner bij openen.
- Rollen en toestemming: account; de partner stemt toe dat zijn naam publiek staat (veld in het partnerdossier, nieuw).
- Uitzonderingen: opgeschorte, verlopen of beëindigde partner: niet zichtbaar.
- Acceptatiecriterium: Gegeven een actieve en een opgeschorte partner in Zwolle, wanneer de bewoner Zwolle opent, dan ziet hij alleen de naam van de actieve.

**BRT-13 Vaste buurtenlijst per stad** · L3 · ontbreekt · kosten middel · complexiteit midden · later (eigenaarsbesluit VERDER.md par. 6)
- Gegevens en bron: per stad een lijst buurtnamen; nu staat de wijk als vrije tekst op de casus en vangt `buurtdrempel.js` alleen hoofdletters en spaties.
- Regels en rekenwijze: de buurt-app gebruikt de lijst alleen om activiteiten op buurt te filteren; de gemeente-drempel gebruikt dezelfde lijst (één bron).
- Onzekerheid: grenzen van buurten verschillen per bron (CBS, gemeente); de keuze is een besluit.
- Wie hoort wat, wanneer: bewoner ziet een buurtfilter.
- Rollen en toestemming: lijst beheren met `stad.beheren`.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven de lijst met "Zeewijk", wanneer een medewerker "Zeewyk" probeert, dan wordt dat geweigerd en kan de gemeentedrempel niet door een tikfout worden omzeild.

**BRT-14 "Mogelijk iets voor jou", alleen toevoegend** · L4 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: interesses die de bewoner zelf aanvinkt (taal, koken, sport), opgeslagen bij zijn eigen account; soorten van open activiteiten.
- Regels en rekenwijze: alleen toevoegen, met de reden erbij ("omdat je taal aanvinkte"); niets wordt weggelaten (FOUNDATION.md par. 5.3); geen verborgen score.
- Onzekerheid: een suggestie is geen voorspelling van wat iemand leuk vindt; het scherm zegt "mogelijk".
- Wie hoort wat, wanneer: alleen de bewoner.
- Rollen en toestemming: interesses zelf aan en uit.
- Uitzonderingen: geen suggesties op basis van een hulpvraag of gezinssituatie.
- Acceptatiecriterium: Gegeven een bewoner met interesse "taal", wanneer hij de stad opent, dan staat het taalcafé bovenaan met "omdat je taal aanvinkte", en zijn alle andere activiteiten nog steeds zichtbaar.

**BRT-15 Drukte- of opkomstvoorspelling** · L4 · niet doen
- Reden: een voorspelling van "bijna vol" werkt als kunstmatige urgentie en zou als feit gelezen worden; de geteld vrije plekken (BRT-02) zijn genoeg.

**BRT-16 Terugblik op posterniveau** · L5 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: een korte tekst die de stad na een afgelopen activiteit schrijft ("Het taalcafé ging deze maand vier keer door"), zonder deelnemersaantal per keer.
- Regels en rekenwijze: geen getal over mensen; geen foto zonder fototoestemming (veld bestaat in `activiteiten-deur.js`); beeld uit De Salon alleen als uitgelicht met naamsvermelding.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: bewoner op de stadspagina, maximaal een maand.
- Rollen en toestemming: schrijven met `project.beheren`.
- Uitzonderingen: activiteiten met een etiketdragende doelgroep krijgen geen terugblik.
- Acceptatiecriterium: Gegeven een afgelopen activiteit met terugblik, wanneer de bewoner de stad opent, dan ziet hij de tekst en geen enkel aantal deelnemers.

**BRT-17 Activiteit in de eigen agenda** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: na BRT-06 een verwijzing (id van de inschrijving) naar `agenda.afspraken` (`apps/agenda.html`); de agenda toont titel, tijd en plek en houdt geen kopie van de inschrijving.
- Regels en rekenwijze: klaarzetten, de bewoner bevestigt "in mijn agenda".
- Onzekerheid: bij een verzette activiteit moet de agenda de nieuwe tijd lezen uit de bron.
- Wie hoort wat, wanneer: alleen de bewoner.
- Rollen en toestemming: eigen account.
- Uitzonderingen: gezinsprofiel van een kind: in de agenda van de ouder.
- Acceptatiecriterium: Gegeven een inschrijving die de stad verzet van 18:00 naar 19:00, wanneer de bewoner zijn agenda opent, dan staat er 19:00 zonder dat hij iets deed.

**BRT-18 Route naar de plek** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: het veld `locatie`; een link naar `navigatie.route` (`apps/navigatie.html`) met de plek als parameter.
- Regels en rekenwijze: alleen verwijzen; de buurt-app kent geen positie van de bewoner.
- Onzekerheid: `locatie` is vrije tekst; een adres kan ontbreken.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: account.
- Uitzonderingen: geen adres: de knop staat er niet.
- Acceptatiecriterium: Gegeven een activiteit met locatie "Buurthuis De Wilg", wanneer de bewoner op "Route" tikt, dan opent de navigatie-app met die plek en is er in de RTF-opslag niets veranderd.

**BRT-19 Projectie in Heel RTG en Vandaag** · L6 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de levensgraaf (`server/kern/levensgraaf/graaf.js`) leest de eigen inschrijvingen via verwijzing.
- Regels en rekenwijze: "Leven" projecteert, is geen eigenaar; de inschrijving blijft in `rtfos`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de bewoner in zijn eigen overzicht.
- Rollen en toestemming: eigen account; gezinsschermen alleen met een geopend profiel.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een inschrijving voor morgen, wanneer de bewoner Vandaag opent, dan ziet hij de activiteit met een link terug naar RTF Buurt, en verwijdert het weghalen in Vandaag de inschrijving niet.

**BRT-20 Hulpvraagcijfers per buurt publiek** · L4 · niet doen
- Reden: op straatniveau is geen drempel hoog genoeg (LEVEN.md par. 2.6, `kern/rtfos/publiek.js`).

**BRT-21 Opgehaald bedrag of thermometer bij campagnes** · L1 · niet doen
- Reden: kunstmatige urgentie, verboden door de merkregels.

**BRT-22 Anoniem lezen zonder account terugzetten** · L1 · niet doen
- Reden: in strijd met het eigenaarsbesluit van 19 oktober 2026; alleen de beschermingsdeur blijft zonder account.

### e. RTG-exclusief

1. **Van buurtmaaltijd naar eigen dag, zonder kopie.** Bewoner kiest activiteit (RTF Buurt) → inschrijving op codenaam (`rtfos`, eigenaar `kantoor.rtfbeheer`-stad) → agenda-item als verwijzing (`agenda.afspraken`, `apps/agenda.html`) → route (`navigatie.route`) → Vandaag toont het via de levensgraaf. Elke schakel houdt zijn eigen data; de inschrijving bestaat één keer.
2. **Ondernemer zichtbaar in de buurt via de keten, niet via reclame.** Een ondernemer biedt maaltijden aan (RTF Portaal, `portaal.toegang`) → het stadsteam koppelt het aan een project (kantoor) → de buurt ziet de activiteit, en alleen als de ondernemer toestemt "met brood van Bakkerij X" (RTF Buurt). Geen ander buurtplatform heeft de aanbodkant en de buurtkant in één keten met een kantoor dat koppelt.
3. **Vrijwilliger met geldige VOG aan het werk binnen één huis.** RTF Buurt toont "VOG vereist" → aanmelden via het vrijwilligersportaal (`werk.vrijwilligerswerk`) → VOG-datum in het register (`vrijwilligers.js`) → inzet alleen bij geldige VOG op de soorten in `VOG_VERPLICHT`. Eigenaar per schakel: Buurt (tonen), vrijwilligersportaal (aanmelden), kantoor (keuren).
4. **Gezinsprofiel als ingang voor het kind.** Een kind ziet de buurt via het gezinsprofiel van de ouder (`magSessie`, `rtf.verifieerProfiel`), schrijft zich in via de ouder (BRT-06), en de grendel bij het inchecken eist de toestemming van de ouder (`activiteiten-deur.js`).

### f. Bouwstenen en ontbrekende koppelingen

Wat er staat: `server/routes/rtfos/doelgroepen.js`, `server/kern/elkesessie.js`, `server/kern/rtfos/publiek.js`, `server/kern/rtfos/activiteiten.js`, `activiteiten-deur.js`, `activiteiten-beheer.js`, `campagnes.js`, `steden.js`, `vrijwilligers.js`, `partners-portaal.js` (`erkend`), `public/apps/foundation/os-publiek.html`, `scripts/lib/voltooi/rtfbuurt.js`, `test/toegang-buurt.test.js`, `test/rtfos-doelgroepen.test.js`.

Wat ontbreekt:
| koppeling | van → naar | vorm |
|---|---|---|
| accountdeur | RTF Buurt → `account.registratie` | verwijzing (link + bestaande `RTGAccountDeur`) |
| beschermingsdeur | RTF Buurt → `rtf.onveilig` | verwijzing, zonder account |
| zelf inschrijven | RTF Buurt → `activiteiten-deur.js` | nieuwe ledenroute op bestaande functie, geen nieuwe data |
| agenda | RTF Buurt → `agenda.afspraken` | verwijzing (inschrijvings-id) |
| route | RTF Buurt → `navigatie.route` | verwijzing (locatie) |
| Vandaag/Heel RTG | `rtfos` → levensgraaf | projectie |
| hulpingangen | RTF Buurt → `rtf.hulpwijzer`, `hulp.wegwijzer`, `overheid.gemeente-burger` | verwijzing |
| erkende partners | RTF Buurt → `partners.erkend` | projectie (alleen naam) |
| tekst van het register | `SCHERMEIGENAAR.json`, kop `publiek.js`, script `os-publiek.html` | tekstcorrectie, geen code |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| BRT-05 Accountdeur en eerlijke 401 | nu | klein | laag | besluit 19 okt. (ligt er) |
| BRT-08 Praktische info per activiteit | nu | klein | laag | — |
| BRT-09 Doorverwijzen | nu | klein | laag | schermen Hulpwijzer/gemeente bestaan |
| BRT-12 Erkende partners | nu | klein | laag | toestemmingsveld partner |
| BRT-18 Route | nu | klein | laag | — |
| BRT-06 Zelf inschrijven | nu | middel | midden | `activiteiten-deur.js`; besluit over etiketdragende soorten |
| BRT-10 Vrijwilligerswerk met VOG/verzekering | nu | middel | midden | stadsveld verzekering |
| BRT-17 Agenda | nu | klein | laag | BRT-06 |
| BRT-07 Afmelden/wachtlijst | later | klein | laag | BRT-06, `comm.berichten` |
| BRT-14 Mogelijk iets voor jou | later | middel | midden | FOUNDATION 5.3 |
| BRT-16 Terugblik | later | klein | laag | fototoestemming |
| BRT-19 Projectie Vandaag | later | middel | midden | BRT-06, levensgraaf |
| BRT-13 Vaste buurtenlijst | later | middel | midden | eigenaarsbesluit VERDER par. 6 |
| BRT-15, BRT-20, BRT-21, BRT-22 | niet doen | — | — | huisregels / besluit |
| BRT-01–04, BRT-11 | bestaat | klein | laag | onderhoud |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket: BRT-05, BRT-08, BRT-09, BRT-12, BRT-18, BRT-06, BRT-10, BRT-17, plus de drie tekstcorrecties uit f. Geen nieuwe motor: inschrijven gebruikt de bestaande deur in `activiteiten-deur.js`, agenda en route zijn verwijzingen, partners komen uit `erkend()`.

Wat de bewoner daarna kan dat hij nu niet kan:
- zonder account zien waarom hij er een nodig heeft en hoe hij er een maakt, en zonder account toch de weg naar de beschermingsdeur vinden;
- een open plek zelf nemen (of op de wachtlijst gaan), zijn kind inschrijven via het gezinsprofiel, en de activiteit in zijn agenda en navigatie krijgen;
- vooraf weten of iets gratis is, toegankelijk is en in welke taal het is;
- zien welke erkende stichtingen in zijn stad meedoen;
- bij vrijwilligerswerk eerlijk lezen dat er een VOG nodig is en of de verzekering is vastgelegd;
- doorklikken naar professionele hulp zonder dat de buurt-app iets vastlegt.

### Uitkomst B — het domeinmaximum

Het eindproduct: RTF Buurt als de sociale kaart van een stad op posterniveau, waar een bewoner, een vrijwilliger en een professional elk hun ingang hebben, en waar elke stap naar een tweede mens één menselijke bevestiging is.

Nieuwe professionele processen die RTG hier kan ondersteunen:

1. **Inloopspreekuur van het sociaal wijkteam of de welzijnsorganisatie** (rol: welzijnswerker of maatschappelijk werker van een partnerstichting; genre: alleen als het in `server/kern/aanmeldingen/bewijs.js` en `server/kern/persoonseis.js` bestaat — twijfel: aan de integrator voorleggen). Proces: spreekuur aanbieden → publiek tonen als activiteit zonder doelgroepetiket → bewoner kiest een tijdslot (klaarzetten, bevestigen) → gesprek → eventueel een casus in het RTF-kantoor op codenaam, alleen met toestemming. Nodig: een activiteitsoort "spreekuur" met tijdslots (**eigenaarsbesluit**: is een tijdslot een nieuwe vorm in `activiteiten.js`?), geen nieuw rechtenmodel.
2. **Gratis VOG-aanvraag klaarzetten voor vrijwilligers** (rol: vrijwilligerscoördinator; geen nieuw genre). Proces: RTF of partner toegelaten tot de regeling (CIBG, extern) → coördinator zet de aanvraag klaar met de screeningsprofielen → vrijwilliger vraagt zelf aan met DigiD (extern) → VOG-datum wordt door een mens van RTG afgetekend (`vakbewijs`-patroon: een ingediend stuk is geen bewijs). Nodig: toelating CIBG (extern), eHerkenning 2+ (extern), **eigenaarsbesluit** of RTF de regeling gebruikt of zelf betaalt, geen koppeling met Justis (RTG valideert niets inhoudelijk).
3. **Verzekeringsmelding bij schade van een vrijwilliger** (rol: coördinator; gemeente als schakel). Proces: schade melden → formulier klaargezet → coördinator bevestigt → gemeente meldt bij de verzekeraar (extern; bij de VNG-polis loopt het via de gemeente). Nodig: per stad vastleggen welke polis geldt (BRT-10), een kanaal naar de gemeente via RTF Portaal; **eigenaarsbesluit** omdat RTG daarmee een stap in een schadeproces wordt.
4. **Buurtbudget of bewonersinitiatief aanvragen** (rol: bewoner als initiatiefnemer, partnerstichting als drager). Proces: idee indienen → partner neemt het op → stad beoordeelt (vierogen bestaat in projecten) → project wordt actief en verschijnt publiek. Nodig: een publieke indieningsroute naar de projectfase "aanvraag" (die blijft onzichtbaar voor de buurt); overlap met Klimaatfonds en Kwesties — **eigenaarsbesluit** om dubbele logica te vermijden.
5. **Maatschappelijke stage en NL Doet-achtige inzetdagen** (rol: school of werkgever als organisator). Proces: inzetdag aanbieden → groep schrijft zich in → uren worden door de stad bevestigd → uren tellen in het register van de vrijwilliger, niet als ranglijst. Nodig: groepsinschrijving (nieuw), school als partner; minderjarigen: geen progressie, alleen een leerdossier onder de vier voorwaarden (FOUNDATION par. 5.5).
6. **Toegankelijkheidsscan van een locatie** (rol: ervaringsdeskundige vrijwilliger). Proces: locatie scannen met vaste vragen → stad bevestigt → het veld "rolstoeltoegankelijk" wordt "gecontroleerd op <datum>". Nodig: niets extern; wel een besluit wie mag aftekenen.
7. **Externe koppelingen** (alle **eigenaarsbesluit**, en een nieuwe koppeling is een besluit): publicatie van open activiteiten naar een gemeentelijke sociale kaart; open data van activiteiten (zonder deelnemers); kalenderfeed per stad.

Huisregels blijven: geen hulpvraaggetal publiek, geen drukte-urgentie, geen ranglijst van vrijwilligers onder 18 of erboven per persoon, geen capaciteitscijfer op een mens (bezetting van vrijwilligers alleen via de rol, FOUNDATION par. 5.4), bevestigen doet de mens, de beschermingsdeur open.

### Ketens LOS en SAMEN

**LOS.** Staan alle andere apps uit, dan blijft de kerntaak: zien welke afdeling open is, wat er loopt, waar je binnen kunt lopen met vrije plekken, en welke campagne er is. Dat leest alles uit `rtfos` en heeft geen andere app nodig. Het scherm zegt eerlijk: "Inschrijven kan nu bij de activiteit zelf of het buurthuis", "Route en agenda zijn op dit moment niet beschikbaar", en bij uitval van de vrijwilligers- of deelnemerspagina: "Deze ingang is tijdelijk dicht; vraag de stad". Zonder sessie: de accountdeur (BRT-05).

**SAMEN — keten "naar de buurtmaaltijd".**
1. Ouder opent RTF Buurt met zijn gratis account (eigenaar: `wereld.foundation`, `os-publiek.html`; sessie via `account.registratie`).
2. Kiest Zwolle, ziet de buurtmaaltijd met 12 plekken vrij (RTF Buurt, data van het RTF-kantoor `kantoor.rtfbeheer`).
3. Schrijft zichzelf en zijn kind in, bevestigt één keer (RTF Buurt → `activiteiten-deur.js`, stad als eigenaar van de inschrijving).
4. Zet het in zijn agenda (`agenda.afspraken`, `apps/agenda.html`).
5. Opent de route op de dag zelf (`navigatie.route`, `apps/navigatie.html`).
6. Checkt in met de code bij de deur (kantoor/stad, `activiteiten-deur.js`).

Storingen:
- *Sessie verlopen (stap 1):* 401 met accountdeur; niets gaat verloren omdat er nog niets is gedaan.
- *Kantoor of `rtfos` onbereikbaar (stap 2):* "Er ging iets mis" in het stedenblok; geen lege lijst die doet alsof er niets loopt (zie de opmerking over LIEGRONDE.json in het script).
- *Inschrijving faalt halverwege (stap 3):* de transactie op `rtfos` laat niets half achter; de ouder ziet "niet ingeschreven, probeer opnieuw"; een tweede tik geeft geen dubbele plek.
- *Agenda uit (stap 4):* de inschrijving staat; de knop zegt "agenda nu niet beschikbaar"; de code staat in RTF Buurt.
- *Navigatie uit (stap 5):* het adres staat als tekst op de activiteit.
- *Incheckcode kwijt (stap 6):* de stad roteert of vernieuwt de code (`/api/rtfos/activiteit/incheckcode`); de oude vervalt.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | lezen, inschrijven, afmelden, agenda, route en doorverwijzen werken vanuit één scherm | voltooiproef `rtfbuurt.js` uitgebreid met een stap per functie (BRT-05 t/m BRT-18) |
| professionele diepte | elke vrijwilligersrol toont de VOG-eis uit `VOG_VERPLICHT` en de vastgelegde verzekering of "niet vastgelegd" | toets die per projectsoort het antwoord vergelijkt met `VOG_VERPLICHT` |
| levenscyclus | een inschrijving doorloopt inschrijven → (wachtlijst) → afmelden of inchecken → terugblik, zonder handwerk van het kantoor behalve bevestigen | scenario met volle activiteit en afmelding |
| samenwerking en rollen | een kind kan alleen via het gezinsprofiel van de ouder worden ingeschreven, en inchecken zonder toestemming faalt | kruisproef in BEVOEGD.json met gezinsprofiel zonder ouder-account |
| domeinintelligentie | suggesties voegen alleen toe, met reden; het aantal zichtbare activiteiten met of zonder interesses is gelijk | toets die beide lijsten telt |
| los functioneren | met agenda, navigatie en vrijwilligersportaal uit blijven steden, stad en campagnes werken en zegt elke uitgevallen knop dat hij uit is | proef met uitgeschakelde verwijzingen |
| RTG-ketens | de keten "naar de buurtmaaltijd" sluit van stap 1 tot 6, en elke storing hierboven geeft de beschreven zin | ketenproef met foutinjectie per schakel |
| bewezen betrouwbaarheid | de acht APPWERKT-bewijzen staan op BEWEZEN, IDOR is gemeten (niet "niet gemeten") en het publieke antwoord bevat geen veld uit de verbodslijst (budget, leider, begeleider, inschrijving, deelnemers, kosten, codenaam) | APPWERKT.json, IDOR.json, `rtfbuurt.js` stap "geen interne velden" |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | wat RTF Buurt alleen verwijst |
|---|---|---|
| account maken | `account.registratie` → `apps/foundation/registreren.html` | link vanuit de accountdeur |
| acute onveiligheid | `rtf.onveilig` → `apps/foundation/onveilig.html` | link, ook zonder account |
| hulp vinden | `rtf.hulpwijzer` → `apps/foundation/hulpwijzer.html`; `hulp.wegwijzer` → `apps/foundation/wegwijzer.html` | link; geen eigen hulpintake |
| Wmo-loket gemeente | `overheid.gemeente-burger` → `apps/gemeente.html` | link; geen eigen aanvraag |
| vrijwilliger worden | `werk.vrijwilligerswerk` → `apps/foundation/os-vrijwilliger.html` | link; VOG en uren daar |
| eigen hulpvraag volgen | `hulp.aanvraagstatus` → `apps/foundation/os-deelnemer.html` | link |
| agenda | `agenda.afspraken` → `apps/agenda.html` | verwijzing op inschrijvings-id |
| route | `navigatie.route` → `apps/navigatie.html` | verwijzing op locatie |
| berichten bij wachtlijst | `comm.berichten` → `apps/comm.html` | klaargezet bericht |
| doneren aan een campagne | `geven.doneren` → `apps/foundation/geven.html` | link; geen bedrag in Buurt |
| buurtgesprek, prikbord | `ontdekken.connect` → `apps/connect.html`; `sociaal.genootschap` → `apps/genootschap.html` | link; twijfel welke van de twee: aan de integrator voorleggen |
| meebeslissen | `democratie.kwestie` → `apps/foundation/kwesties.html`; `gemeenschap.klimaatfonds` → `apps/foundation/klimaatfonds.html` | link |
| stadsbeheer | `kantoor.rtfbeheer` → `apps/foundation/kantoor.html` | Buurt leest alleen wat het kantoor openzet |

---


---

## 7. RTF Portaal — `link:rtfportaal`, `/apps/foundation/os-portaal.html`

RTF Portaal is de ene deur voor de drie organisaties buiten het RTF-kantoor die met de foundation samenwerken: de lokale partnerstichting (code RTFP), de gemeente (RTFG) en de lokale ondernemer (RTFO). Elk opent met een gratis RTG-account én de code die het kantoor uitgaf precies één dossier: de stichting haar status, looptijd, doel, de vijf afspraken over wie wat doet (geld, vrijwilligers, persoonsgegevens, aansprakelijkheid, rapportage), haar projecten en haar documentenlijst; de gemeente uitsluitend getelde cijfers (bereik, buurten onder een drempel samengevoegd, besteding, doelen) plus haar eigen opdrachten en prestatieafspraken; de ondernemer zijn aanbod en waar het terechtkwam, met de waarde als schatting. De code koppelt het eerste account dat hem opent aan het dossier (`server/kern/codekoppel.js`); voor elk ander account bestaat hij niet. Het scherm leest alleen; alle wijzigingen doet het kantoor.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | afgeleid (3 stappen) | |
| voltooibaar | GEEN_FIXTURE | gesloten, 8 stappen | `scripts/lib/voltooi/rtfportaal.js`: drie portalen, onbekende code, 401, ander account 404, kruiscode, geen persoons- of bankvelden |
| waarheidsgetrouw | BEWEZEN | — | "niet gemeten" staat als niet gemeten, niet als nul (proefstap) |
| persistent | GEEN_FIXTURE | gesloten, 3 stappen | herstart, opslaglezer, wijziging kantoor na herstart zichtbaar |
| bevoegd | BEWEZEN | — | BEVOEGD.json 1/1 |
| herstelbaar | GEEN_FIXTURE | gesloten, 3 stappen | dubbele tik, afgebroken verzoek, crash |
| IDOR | — | — | 2 routes onbereikbaar (de meter had geen id van A; niet bewezen) |

Wat de code doet (gelezen in de repo):
- **Routes** (`server/routes/rtfos/portalen.js`): `POST /api/rtfos/portaal/partner`, `/portaal/partner/genootschap`, `/portaal/partner/genootschap/erken`, `/portaal/gemeente`, `/portaal/ondernemer`, alle met `auth`, een bronrem (20/min per IP) en een coderem (60/min per code), en `koppel.met(req, soort, code, werk)`. Kantoorkant: `/api/rtfos/partner|gemeente|ondernemer/code/roteren` met `officeAuth`.
- **`kern/codekoppel.js`**: zonder sessiesleutel 401; de eerste geslaagde opening legt sessiesleutel en codenaam vast onder een SHA-256 van soort en code (de code zelf staat er niet); een ander account krijgt 404 met dezelfde zin als een onbekende code; elke opening telt (aantal, laatste keer); na de werkstap wordt de koppeling opnieuw gelezen (twee accounts tegelijk); `vervalt()` bij roteren.
- **`kern/rtfos/coderoteer.js`**: roteren door een kantoormens op naam, via `poort` met `partner.beoordelen` resp. `stad.beheren`+`municipal_reporting` resp. `stad.beheren`+`business_sponsorships`, met auditregel; de oude code gaat voor iedereen dicht.
- **Partner** (`partners.js`, `partners-portaal.js`, `afspraken.js`): statusketen `aangemeld → in_toetsing → goedgekeurd → actief → opgeschort → beeindigd`; goedkeuren en actief alleen landelijk; actief alleen met een document van soort `overeenkomst`; drie dichte deuren met eigen zin (beëindigd, opgeschort, verlopen); het portaal toont `partnerBeeld` zonder KvK, RSIN, IBAN, bestuurders en beoordelingen; documenten als verwijzing (soorten o.a. `privacyafspraak`, `vog-beleid`, `verzekering`, `anbi-beschikking`); `erkend()` voor de genootschapsdrager.
- **Gemeente** (`gemeente.js`, `buurtdrempel.js`, `rapport.js`): `portaal()` roept alleen `cijfersVan(stad)` aan; buurten met minder dan K=5 hulpvragen samengevoegd, querveilig gerekend (afleidbaarheid van verborgen buurten, complementaire onderdrukking); `gemeten: false` in plaats van nullen; `kostenPerPersoon` alleen als besteed én geholpen > 0; opdrachten met omschrijving, KPI, bedrag, deadline, status (`lopend`, `verantwoord`, `afgesloten`) en voortgang.
- **Ondernemer** (`ondernemers.js`): aanbod met 11 soorten (geld t/m sponsoring), ritme, aantal, `waardeGeschat`; status `open → gekoppeld → benut | vervallen`; `benut` alleen met project; koppelen alleen binnen dezelfde stad; portaal toont impact (aanbiedingen, benut, geschatte waarde, projecten).
- **Scherm** (`os-portaal.html`): één invoerveld, het voorvoegsel kiest het portaal; een RTFV- of RTFD-code wijst naar de juiste pagina; de code gaat niet in localStorage of een cookie; `RTGAccountDeur.eis(...)` vóór het openen.
- **Bevindingen bij het lezen:**
  1. **Gemeente krijgt `perSoort` ongedrempeld.** `gemeente.portaal()` geeft `perSoort: cij.hulpvragen.perSoort` rechtstreeks door; alleen `perWijk` gaat door `buurtdrempel`. Ook `deelnemersUniek` en de indicatoren per project gaan zonder drempel. Een soort met één hulpvraag in een kleine stad, of een project met twee deelnemers, is een klein getal dat LEVEN.md par. 2.6 juist wil vermijden. Dit is een lezing van de code, geen gemeten lek; aan de integrator voorleggen.
  2. **De genootschapsroutes hebben geen knop in het scherm.** `/portaal/partner/genootschap` en `/erken` bestaan; `os-portaal.html` roept ze niet aan (grep op "genootschap" leeg). De voltooiproef noemt ze buiten bereik.
  3. **Documenten hebben `geldigTot`, maar het portaal en de status kijken er niet naar.** `documentMaak` slaat `geldigTot` op; `partnerBeeld` toont alleen id, soort, naam, at; een verlopen verzekering of verwerkersafspraak valt nergens op.
  4. **Gemeenteopdracht en subsidiemodule zijn twee plekken met een bedrag.** `gemeente.opdrachtZet` houdt `bedragCenten` vast; `subsidies.js` heeft een soort `gemeente` met toegekend bedrag en een geoormerkte bron. Er is geen verwijzing tussen die twee.
  5. **Intrekken zonder nieuwe code ontbreekt** voor partner, gemeente en ondernemer (wel roteren); de kop van `portalen.js` zegt nog "geen vervaldatum en geen intrekknop".

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Benevity | modules per werkgever; Enterprise-contracten | geen lijstprijs; Vendr meldt mediaan circa $48.733 per jaar (bereik circa $32.805–$94.620); Softwarefinder schat $40.000–$120.000+ per jaar (benchmark, geen offerte); transactiekosten op donaties | werknemersgeven, matching, vrijwilligerswerk, community investment; non-profitportaal | Benevity nonprofits — https://benevity.com/nonprofits (eerder zoekresultaat 2026-10-19, pagina niet geopend); Vendr — https://www.vendr.com/marketplace/benevity (zoekresultaat 2026-10-19, pagina niet geopend); Softwarefinder — https://softwarefinder.com/nonprofit/benevity (zoekresultaat 2026-10-19, pagina niet geopend) |
| Submittable (Grants) | grant- en applicatiebeheer; Enterprise (eigen huisstijl, eigen integraties, fondsuitkering) | alleen op offerte; volgens SmarterSelect (via Capterra) vanaf $10.000 per jaar; geen gratis plan (Toolradar) | aanvragen, beoordeling, uitkering, rapportage | Submittable grants — https://www.submittable.com/solutions/grants (eerder zoekresultaat 2026-10-19, pagina niet geopend); Software Advice — https://www.softwareadvice.com/hr/submittable-profile (zoekresultaat 2026-10-19, pagina niet geopend); SmarterSelect — https://www.smarterselect.com/blog/submittable-pricing (zoekresultaat 2026-10-19, pagina niet geopend); Toolradar — https://toolradar.com/tools/submittable/pricing (zoekresultaat 2026-10-19, pagina niet geopend) |
| Hoplr (gemeentekant) | gemeentecontract | geen gegevens | consultatie, buurtinitiatieven, communicatie gemeente-bewoner | Hoplr — https://services.hoplr.com/ (eerder zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:
- Eén dossier per organisatie, alleen het eigen: **ja**.
- Getelde cijfers voor de financier, met privacydrempel: **half** (buurten wel, soorten en projecten niet; zie bevinding 1).
- Subsidieaanvraag en -verantwoording door de ontvanger zelf indienen: **nee** (alleen het kantoor schrijft; de subsidiemodule is kantoorkant).
- Impact van een bedrijfsbijdrage terugzien: **ja** (benut, project, geschatte waarde).
- Matching en werknemersgeven: **nee** (andere app; zie Behoeften).
- Documenten uploaden door de partner: **nee** (verwijzingen door het kantoor).
- Toegangsbeheer per medewerker: **half** (één code per account; geen tweede medewerker op hetzelfde dossier zonder nieuwe code).
- Export (pdf of csv) voor de raad of het jaarverslag: **nee**.

### c. Het volledige domein

**Hoe mensen hier echt werken.**
- *Partnerstichting.* Een lokale stichting (buurtwerk, schuldhulp, voedselbank) werkt met een samenwerkingsovereenkomst, statuten, een jaarrekening, soms een ANBI-beschikking, een VOG-beleid en een verzekering. Ze rapporteert per kwartaal of jaar aan financiers. Bij persoonsgegevens moet vastliggen wie verwerkingsverantwoordelijke is en wie verwerker; tussen verantwoordelijke en verwerker vraagt de AVG een schriftelijke overeenkomst (art. 28 lid 3 AVG noemt onder meer onderwerp, duur, aard en doel, soorten gegevens, categorieën betrokkenen, instructies, geheimhouding, beveiliging; bron: Captain Legal — https://www.captain.legal/nl/bedrijfsbeheer/verwerkersovereenkomst-avg-opstellen-word-en-pdf/ (zoekresultaat 2026-10-19, pagina niet geopend)). De feitelijke rolverdeling telt, niet de naam van het contract (zelfde zoekresultaat).
- *Gemeente.* Een beleidsmedewerker of accountmanager subsidies verleent subsidie op grond van titel 4.2 van de Algemene wet bestuursrecht en een lokale Algemene subsidieverordening; daarna volgt verantwoording en vaststelling, met termijnen en soms een accountantsverklaring (Venlo: binnen 12 weken na afloop bij eenmalige subsidie, 1 mei bij meerjarige; bron: Venlo accountantsprotocol — https://www.venlo.nl/sites/default/files/2025-05/accountantsprotocol-behorend-bij-de-algemene-subsidieverordening-venlo.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Lelystad controleprotocol — https://www.gemeentelelystad.nl/Documenten/Controleprotocol%20subsidieverstrekkingen.pdf (zoekresultaat 2026-10-19, pagina niet geopend)). Het zoekresultaat noemt art. 4:21 lid 1 Awb als subsidiedefinitie en afdeling 4.2.8 voor per-boekjaarsubsidies. Gemeenten sturen in het sociaal domein (Wmo 2015, Jeugdwet) steeds vaker op maatschappelijke effecten; een Maatschappelijke Business Case laat zien welke investering bij welke partij welke baten oplevert (Nijmegen liet in 2016 acht MBC's maken; bron: Nijmegen raadsinformatie — https://nijmegen.bestuurlijkeinformatie.nl/Document/View/2cc2e14b-186f-4fb7-9ea3-c67ecfab4ffc en Binnenlands Bestuur — https://www.binnenlandsbestuur.nl/sociaal/omgevingswet/nijmegen-transformeert-zorg-planmatig-en-meerjarig, beide zoekresultaat 2026-10-19, pagina niet geopend). Een verwante methode is de MKBA (Groningen; bron: https://gemeenteraad.groningen.nl/Documenten/Bijlage/Presentatie-AEF-effectiviteit-subsidies-sociaal-domein.pdf, zoekresultaat 2026-10-19, pagina niet geopend). Er is volgens de zoekresultaten geen enkele landelijke officiële MBC-methode.
- *Lokale ondernemer.* Een bakker, restaurant of garage geeft in natura (maaltijden, vervoer, ruimte, stageplekken) en wil horen waar het terechtkwam; voor zijn eigen administratie wil hij weten wat fiscaal telt. Sponsoring en giften in natura hebben fiscale gevolgen die per geval verschillen.

**Regels en keurmerken.**
- AVG/UAVG: verwerkersovereenkomst of gezamenlijke verantwoordelijkheid; gegevens van hulpvragers verlaten de partner niet als losse regels.
- LEVEN.md par. 2.6: naar gemeenten alleen geaggregeerd, met een harde ondergrens, nooit herleidbaar tot een wijk.
- Awb titel 4.2 en de lokale subsidieverordening: verantwoording, vaststelling, terugvordering.
- ANBI-regeling (AWR) en CBF-erkenningsregeling: documenttypes die een partnerdossier kan dragen; RTG toetst ze niet inhoudelijk.
- Gratis VOG-regeling: vraagt een gepubliceerd preventie- en integriteitsbeleid (het documenttype `vog-beleid` bestaat al).
- Fiscale uitspraken over giften in natura of sponsoring: alleen in de vier klassen van `server/kern/fiscaal/zekerheid.js`.

**Wat daaruit volgt voor de app.**
1. Het gemeenteportaal moet élk getal door een drempel halen, niet alleen de buurten.
2. Het partnerdossier moet laten zien wat ontbreekt of verloopt (overeenkomst, verwerkersafspraak, verzekering, VOG-beleid), met datum.
3. De gemeente wil haar opdracht en de verantwoording op één plek, zonder dat het bedrag op twee plekken leeft.
4. Een export voor raad of jaarverslag moet dezelfde getallen geven als het scherm.
5. Een ondernemer mag horen wat zijn bijdrage deed, nooit wie hij hielp.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk (de medewerker achter de code):** goed: één deur, code niet in de browser bewaard, eerlijke foutzinnen; zwak: geen overzicht van welke codes aan mijn account hangen.
- **L2 Professioneel (bestaande genres):** de stichting, de gemeente en de ondernemer zijn organisaties, geen genres uit `bewijs.js`; de professionele diepte zit in subsidieverantwoording en AVG-afspraken, die half aanwezig zijn.
- **L3 Organisatorisch:** sterk in scheiding (één code, één dossier, rotatie met audit); zwak in meerdere medewerkers per organisatie en in intrekken.
- **L4 Domeinintelligentie:** geteld en eerlijk (`gemeten: false`, kosten per persoon alleen met beide kanten); maar de drempel dekt niet alle getallen, en er is geen impactmodel.
- **L5 Volledige levenscyclus:** de partner ziet zijn status maar kan niets indienen; de gemeente ziet opdrachten maar kan niet vaststellen; de ondernemer kan geen nieuw aanbod doen.
- **L6 RTG-samenhang:** alleen de genootschapsdrager is verbonden (zonder knop); geen koppeling met Bestanden, Berichten, de subsidiemodule of de zaakkant van de ondernemer.

**PRT-01 Eén deur, voorvoegsel kiest het portaal** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `soortVan(code)` in `os-portaal.html`; RTFV/RTFD wijzen naar `os-vrijwilliger.html`/`os-deelnemer.html`.
- Regels en rekenwijze: de code blijft alleen in het geheugen van het tabblad.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de medewerker bij openen.
- Rollen en toestemming: account + code.
- Uitzonderingen: een code zonder bekend voorvoegsel: uitleg en "vraag het RTF-kantoor".
- Acceptatiecriterium: Gegeven een vrijwilligerscode RTFV-…, wanneer iemand hem in het portaal invoert, dan ziet hij een link naar de vrijwilligerspagina en wordt er niets naar de server gestuurd.

**PRT-02 Account en code: eerste account koppelt** · L3 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `kern/codekoppel.js` (hash van soort en code, sessiesleutel, codenaam, aantal, laatst).
- Regels en rekenwijze: tweede account 404 met dezelfde zin als een onbekende code; koppeling pas na een geslaagd antwoord.
- Onzekerheid: wie de code eerst onderschept, koppelt eerst; het kantoor herstelt door te roteren.
- Wie hoort wat, wanneer: het kantoor kan `koppelingVan` lezen (codenaam, sinds, aantal).
- Rollen en toestemming: elk account met een geldige code, de eerste keer.
- Uitzonderingen: geen sessie: 401.
- Acceptatiecriterium: Gegeven een partnercode die account A opende, wanneer account B dezelfde code invoert, dan krijgt B 404 met "Deze code kennen we niet" en bevat het antwoord geen naam van de stichting.

**PRT-03 Partnerdossier: status, looptijd en de vijf afspraken** · L3 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `partnerBeeld` (naam, stad, status, doel, werkgebied, van, tot, verlopen, afspraken, bevoegdheden, documenten), projecten met `partnerId`.
- Regels en rekenwijze: geen KvK, RSIN, IBAN, bestuurders of beoordelingen; drie dichte deuren met eigen zin.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gekoppelde medewerker bij openen.
- Rollen en toestemming: account + RTFP-code.
- Uitzonderingen: opgeschort: "neem contact op"; verlopen: "RTF maakt een nieuwe overeenkomst"; beëindigd: dicht.
- Acceptatiecriterium: Gegeven een partner met `tot` gisteren, wanneer de medewerker opent, dan krijgt hij 403 met de datum van verlopen en geen dossier.

**PRT-04 Gemeenteportaal: getelde cijfers en opdrachten** · L4 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `cijfersVan(stad)` (`rapport.js`), `buurtdrempel(K=5)`, opdrachten.
- Regels en rekenwijze: buurten onder K samengevoegd en querveilig; `gemeten: false` in plaats van nul; kosten per persoon alleen bij beide kanten.
- Onzekerheid: `uniekGeholpen` is wat projecten invullen, geen gecontroleerd getal.
- Wie hoort wat, wanneer: de gemeentemedewerker bij openen.
- Rollen en toestemming: account + RTFG-code.
- Uitzonderingen: stadsafdeling bestaat niet meer: 404.
- Acceptatiecriterium: Gegeven een stad zonder ingevulde deelnemers, wanneer de gemeente opent, dan staat er "niet gemeten" en geen 0 en geen "0 euro per persoon".

**PRT-05 Drempel op álle gemeentegetallen** · L4 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `perSoort`, `deelnemersUniek` en indicatoren per project, vrijwilligersaantal (`gemeente.portaal`, `rapport.js`).
- Regels en rekenwijze: dezelfde K en dezelfde afleidbaarheidstoets als `buurtdrempel.js` (één functie, geen tweede kopie): soorten onder K samengevoegd tot "overige soorten", projectaantallen onder K als "minder dan 5", en geen combinatie waaruit een verborgen getal is af te leiden (totaal min de rest).
- Onzekerheid: kruistabellen tussen soorten en buurten; de toets moet ook dat kruisen dekken.
- Wie hoort wat, wanneer: de gemeente, bij openen.
- Rollen en toestemming: ongewijzigd.
- Uitzonderingen: geen; ook niet voor een gemeente die erom vraagt (LEVEN par. 2.6).
- Acceptatiecriterium: Gegeven een stad met 1 hulpvraag "huiselijk" en 12 "schulden", wanneer de gemeente opent, dan komt het getal 1 nergens in het antwoord voor en is het ook niet af te leiden uit het totaal en de getoonde soorten.

**PRT-06 Ondernemersportaal: aanbod en waar het terechtkwam** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `ondernemers.portaal()`.
- Regels en rekenwijze: waarde heet `waardeGeschat` en telt alleen bij `benut`; project met naam, soort, doelgroep, nooit deelnemers.
- Onzekerheid: de schatting komt van het kantoor.
- Wie hoort wat, wanneer: de ondernemer bij openen.
- Rollen en toestemming: account + RTFO-code.
- Uitzonderingen: niets benut: "geen verwijt aan u".
- Acceptatiecriterium: Gegeven een benut aanbod van 20 broden aan een voedselbankproject, wanneer de ondernemer opent, dan ziet hij de projectnaam en "geschatte waarde", en geen naam of aantal ontvangers.

**PRT-07 Code roteren door het kantoor** · L3 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `coderoteer.js`, `codekoppel.vervalt`.
- Regels en rekenwijze: kantoormens op naam, recht in de stad, auditregel; oude code dicht voor iedereen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het kantoor geeft de nieuwe code persoonlijk door.
- Rollen en toestemming: `partner.beoordelen` of `stad.beheren` + module.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een geroteerde partnercode, wanneer het eerder gekoppelde account de oude code invoert, dan krijgt het 404, en opent het nieuwe account met de nieuwe code het dossier.

**PRT-08 Intrekken en vervaldatum van een code** · L3 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: patroon van `vrijwilligerportaal.codeIntrekken` en `deelnemerportaal.codeIntrekken` (bestaan al in `doelgroepen.js`).
- Regels en rekenwijze: intrekken zonder nieuwe code (medewerker vertrokken, samenwerking stopt); optionele vervaldatum; auditregel.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het dossier zegt bij openen "Deze toegang is ingetrokken; vraag het kantoor" (niet 404, want de gekoppelde mag weten dat zijn toegang stopte).
- Rollen en toestemming: zelfde rechten als roteren.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een ingetrokken gemeentecode, wanneer het gekoppelde account opent, dan ziet het de intrekzin en geen cijfers, en ziet een ander account 404.

**PRT-09 Meerdere medewerkers per organisatie** · L3 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: nu één code per dossier en één account per code (`coderoteer.js`: "met een code per medewerker" in de kop, maar één `code`-veld per rij).
- Regels en rekenwijze: per dossier een lijst codes met elk een eigen koppeling, label ("financiën", "coördinator") en eigen intrekking; geen tweede rechtenmodel: de code blijft de sleutel, het account de identiteit.
- Onzekerheid: de grens tussen dit en een organisatie-account in `werk.organisatie` (`apps/werk.html`) — twijfel: aan de integrator voorleggen.
- Wie hoort wat, wanneer: het kantoor ziet per code de codenaam en laatste opening.
- Rollen en toestemming: kantoor geeft uit.
- Uitzonderingen: maximum per dossier.
- Acceptatiecriterium: Gegeven een stichting met twee codes, wanneer het kantoor er één intrekt, dan opent de andere medewerker nog steeds.

**PRT-10 Dossiercompleetheid en verloopdata** · L5 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `documenten[].geldigTot` (wordt al opgeslagen), `DOCSOORT`.
- Regels en rekenwijze: per verplicht documenttype (overeenkomst; bij `afspraken.persoonsgegevens` ≠ niemand: privacyafspraak; bij vrijwilligers met kinderen: vog-beleid; verzekering) "aanwezig tot <datum>", "verloopt binnen 60 dagen", "verlopen" of "ontbreekt". Alleen gerekend, niet opgeslagen.
- Onzekerheid: RTG toetst de inhoud niet; "aanwezig" betekent "verwijzing staat er".
- Wie hoort wat, wanneer: de partner in zijn portaal; het kantoor in zijn lijst.
- Rollen en toestemming: ongewijzigd.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een verzekering met `geldigTot` gisteren, wanneer de partner opent, dan staat bij verzekering "verlopen" en niet "aanwezig".

**PRT-11 Stukken aanleveren door de partner (klaarzetten)** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: het bestand in `docs.bestanden` (`apps/bestanden.html`); in het dossier alleen een verwijzing (zoals `documentMaak` al doet).
- Regels en rekenwijze: de partner zet een stuk klaar en bevestigt het indienen; het kantoor tekent af ("een ingediend stuk is geen bewijs"); pas dan staat het als document in het dossier.
- Onzekerheid: geen inhoudelijke toets.
- Wie hoort wat, wanneer: kantoor krijgt een taak; partner ziet "ingediend, nog niet beoordeeld".
- Rollen en toestemming: gekoppeld account; aftekenen met `partner.beoordelen`.
- Uitzonderingen: bestanden met persoonsgegevens van deelnemers: geweigerd met uitleg.
- Acceptatiecriterium: Gegeven een partner die een jaarrekening indient, wanneer hij opent voordat het kantoor aftekende, dan staat er "ingediend, nog niet beoordeeld" en telt het niet als aanwezig.

**PRT-12 Subsidieverantwoording aan de gemeente, één bron** · L2 · half · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `subsidies.js`/`subsidies-keten.js` (soort `gemeente`, momenten, bewijs, status `verantwoord` alleen als alle momenten af en er bewijs is) en de gemeenteopdracht (`gemeente.opdrachtZet`).
- Regels en rekenwijze: de opdracht krijgt een verwijzing naar de subsidie (id) in plaats van een eigen bedrag; het gemeenteportaal toont bedrag, momenten en status uit de subsidie (geen tweede bedrag, LAT.md regel 4).
- Onzekerheid: bestaande opdrachten met een eigen bedrag moeten eenmalig worden gekoppeld.
- Wie hoort wat, wanneer: de gemeente ziet de stand per rapportagemoment en de verantwoordingsdatum.
- Rollen en toestemming: koppelen met `geld.beheren` + `subsidy_management`.
- Uitzonderingen: opdracht zonder subsidie (bedrag 0): mag.
- Acceptatiecriterium: Gegeven een opdracht gekoppeld aan een toegekende subsidie met één open rapportagemoment, wanneer de gemeente opent, dan ziet ze het bedrag uit de subsidie en "1 rapportagemoment open", en bestaat er geen tweede bedrag in de opdracht.

**PRT-13 Verantwoordingsrapport als export** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: exact het portaalantwoord (na PRT-05).
- Regels en rekenwijze: pdf of csv met datum van meting, de drempeluitleg en "niet gemeten" waar het niet gemeten is; elk getal met herkomst (projecten, bronnen).
- Onzekerheid: een export verlaat het huis; daarom alleen wat de drempel doorliet.
- Wie hoort wat, wanneer: de gemeente op verzoek; het kantoor ziet in de audit dat er geëxporteerd is.
- Rollen en toestemming: gekoppeld account; één bevestiging ("export maken").
- Uitzonderingen: geen export van een stad met minder dan K hulpvragen in totaal: alleen projecten en geld.
- Acceptatiecriterium: Gegeven het gemeenteportaal op een dag, wanneer de gemeente exporteert, dan zijn alle getallen in de export gelijk aan het scherm van dat moment.

**PRT-14 Impactbeeld volgens een maatschappelijke business case** · L4 · ontbreekt · kosten groot · complexiteit hoog · later
- Gegevens en bron: de bestaande indicatoren (doel, bereikt, doorgestroomd, uitgevallen) en besteding; een door de stad ingevuld referentiescenario.
- Regels en rekenwijze: kosten en baten per partij, uitsluitend als scenario gelabeld ("een voorspelling is nooit een feit"), met de bron per aanname; geen cijfer op een mens.
- Onzekerheid: groot; baten zijn aannames. Het scherm zegt dat.
- Wie hoort wat, wanneer: gemeente en kantoor.
- Rollen en toestemming: invullen door het kantoor.
- Uitzonderingen: een stad zonder indicatoren krijgt geen MBC.
- Acceptatiecriterium: Gegeven een MBC met één aanname zonder bron, wanneer hij in het portaal staat, dan staat bij die aanname "zonder bron" en wordt de uitkomst "scenario" genoemd, nooit "resultaat".

**PRT-15 Ondernemer meldt zelf nieuw aanbod** · L5 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `ondernemers.aanbodMaak` (nu alleen kantoor).
- Regels en rekenwijze: de ondernemer zet een aanbod klaar (soort, wat, aantal, ritme); het staat als "voorgesteld" tot het kantoor het bevestigt en een waarde schat; geen bedrag dat zich als ontvangen geld voordoet.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: stadsteam krijgt een taak.
- Rollen en toestemming: gekoppeld account voorstellen; kantoor bevestigt.
- Uitzonderingen: soort `geld` loopt via `geven.doneren` of RTG Pay en niet als aanbod — twijfel: aan de integrator voorleggen.
- Acceptatiecriterium: Gegeven een ondernemer die "10 maaltijden per week" voorstelt, wanneer het kantoor nog niet bevestigde, dan telt het niet mee in "openstaand" van de stad en ziet de ondernemer "voorgesteld".

**PRT-16 Fiscale vraag van de ondernemer over giften in natura** · L2 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: `server/kern/fiscaal/zekerheid.js` (vier klassen).
- Regels en rekenwijze: het portaal geeft geen fiscale uitspraak zelf; het verwijst naar de fiscale laag van de zaakkant en draagt de klasse "advies" mee (rekenen mag, een mens met vakkennis beoordeelt).
- Onzekerheid: per geval verschillend.
- Wie hoort wat, wanneer: alleen de ondernemer.
- Rollen en toestemming: account.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een ondernemer die vraagt of zijn broden aftrekbaar zijn, wanneer hij de fiscale link volgt, dan eindigt elk antwoord met de zin van klasse advies of voorbehouden en nooit met "bepaald".

**PRT-17 Genootschap erkennen als drager** · L6 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `genootschapDrager.voorPartner` en `.erken` (routes bestaan), `partners.erkend()`.
- Regels en rekenwijze: naam en stand van genootschappen die de stichting vroegen, nooit leden of aantallen; erkennen is één bevestiging van de medewerker.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het genootschap ziet dat het erkend is (`sociaal.genootschap`).
- Rollen en toestemming: gekoppeld account; stichting moet zelf erkend zijn.
- Uitzonderingen: niet-erkende stichting: 403 met zin.
- Acceptatiecriterium: Gegeven een genootschap dat de stichting vroeg, wanneer de medewerker in het portaal op "Erkennen" tikt en bevestigt, dan is het genootschap gedragen, en zag de medewerker geen ledenaantal.

**PRT-18 Berichten tussen organisatie en stadsteam** · L6 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: `comm.berichten` (`apps/comm.html`); het dossier houdt alleen een verwijzing naar de draad.
- Regels en rekenwijze: één draad per dossier; geen persoonsgegevens van deelnemers in berichten (waarschuwing bij invoer).
- Onzekerheid: wat mensen toch typen.
- Wie hoort wat, wanneer: kantoor en gekoppelde medewerker(s).
- Rollen en toestemming: gekoppeld account.
- Uitzonderingen: opgeschorte partner: draad blijft leesbaar, niet schrijfbaar — twijfel: aan de integrator voorleggen.
- Acceptatiecriterium: Gegeven een opgeschorte partner, wanneer de medewerker een bericht wil sturen, dan ziet hij de reden en kan hij het kantoor bellen.

**PRT-19 Mijn codes: welke dossiers hangen aan mijn account** · L1 · ontbreekt · kosten klein · complexiteit laag · later
- Gegevens en bron: `codekoppelingen` met eigen sessiesleutel; de code zelf staat er niet (alleen hash).
- Regels en rekenwijze: toont soort en naam van het dossier, niet de code; openen vraagt de code opnieuw (de code blijft de tweede sleutel).
- Onzekerheid: de koppeling hangt aan de sessiesleutel (`s.key`); of die per account stabiel is over sessies heen, heb ik niet vastgesteld.
- Wie hoort wat, wanneer: alleen de eigenaar.
- Rollen en toestemming: eigen account.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een account met een partner- en een ondernemerkoppeling, wanneer het "mijn codes" opent, dan ziet het twee namen en geen enkele code.

**PRT-20 Gemeente ziet een dossier of naam "in uitzonderingsgevallen"** · L3 · niet doen
- Reden: de gemeente is financier en partner, geen meelezer; er is met opzet geen vinkje (`gemeente.js`, LEVEN par. 2.6).

**PRT-21 Partner ziet de RTF-beoordeling van zichzelf** · L3 · niet doen
- Reden: een oordeel dat je aan de beoordeelde toont, wordt een oordeel dat je niet meer durft op te schrijven (`partners-portaal.js`).

**PRT-22 Ranglijst van ondernemers op waarde** · L4 · niet doen
- Reden: competitieve laag en geschatte waarde als feit; de waarde is een schatting en een ranglijst maakt er een stand van.

### e. RTG-exclusief

1. **Van broodaanbod tot buurtmaaltijd tot gemeentecijfer, zonder dat iemand een naam ziet.** Ondernemer stelt aanbod voor (Portaal, `portaal.toegang`) → stadsteam koppelt aan project en zet het op benut (`kantoor.rtfbeheer`) → project draait activiteiten die de buurt ziet (`wereld.foundation`) → gemeente ziet het project, de indicatoren en de besteding geteld (Portaal) → ondernemer ziet "terechtgekomen bij". Elke schakel leest via verwijzing (projectId) uit `rtfos`; er is één aanbod, één project, één getal.
2. **Subsidie als één verplichting door het hele huis.** Gemeente kent toe (extern) → kantoor zet de subsidie op toegekend, wat zelf de geoormerkte bron maakt (`subsidies-keten.js`, `geld.js`) → opdracht in het gemeenteportaal verwijst ernaar (PRT-12) → verantwoording kan pas als alle momenten af zijn → export (PRT-13). Eigenaar: kantoor (subsidie, bron), Portaal (zicht voor gemeente).
3. **Stichting draagt een genootschap.** Erkende stichting (partnerregister) → erkent in het portaal een genootschap (`genootschap/drager.js`) → genootschap verschijnt in `sociaal.genootschap` als gedragen. Eigenaar: kantoor (erkenning stichting), Portaal (erkennen), Genootschap (eigen leden).
4. **Codenaam over de grens.** Elke opening hangt aan een codenaam in `codekoppelingen`; het kantoor ziet wie (codenaam) wanneer opende; de echte naam blijft in de kluis (`accounts.js`).

### f. Bouwstenen en ontbrekende koppelingen

Wat er staat: `server/routes/rtfos/portalen.js`, `server/kern/codekoppel.js`, `server/kern/rtfos/coderoteer.js`, `partners.js`, `partners-portaal.js`, `afspraken.js`, `gemeente.js`, `buurtdrempel.js`, `rapport.js`, `ondernemers.js`, `subsidies.js`, `subsidies-keten.js`, `server/kern/genootschap/drager.js`, `public/apps/foundation/os-portaal.html`, `scripts/lib/voltooi/rtfportaal.js`, tests `test/toegang-portalen.test.js`, `test/toegang-portaalrotatie.test.js`, `test/legacy-codeportaal-productiepoort.test.js`, `test/rtfos.test.js`.

Wat ontbreekt:
| koppeling | van → naar | vorm |
|---|---|---|
| drempel op alle getallen | `rapport.cijfersVan` → `gemeente.portaal` | dezelfde functie als `buurtdrempel`, geen kopie |
| opdracht ↔ subsidie | gemeenteopdracht → `subsidies.js` | verwijzing (subsidie-id), bedrag één keer |
| stukken aanleveren | Portaal → `docs.bestanden` (`apps/bestanden.html`) | verwijzing; dossier houdt alleen de pointer |
| berichten | Portaal → `comm.berichten` (`apps/comm.html`) | verwijzing naar draad |
| genootschapsknop | `os-portaal.html` → routes `/portaal/partner/genootschap*` | scherm, routes bestaan |
| fiscale vraag | Portaal → zaakkant fiscaal (`kern/fiscaal/zekerheid.js`) | verwijzing |
| ondernemer als zaak | RTFO-dossier → `werk.organisatie`/zaakaccount | verwijzing (twijfel: aan de integrator voorleggen) |
| intrekken | kantoor → partner/gemeente/ondernemer-code | nieuwe kantoorroute volgens bestaand patroon |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| PRT-05 Drempel op alle getallen | nu | klein | midden | LEVEN 2.6; `buurtdrempel.js` |
| PRT-08 Intrekken en vervaldatum | nu | klein | laag | patroon vrijwilliger/deelnemer |
| PRT-10 Dossiercompleetheid | nu | klein | laag | — |
| PRT-17 Genootschapsknop | nu | klein | laag | routes bestaan |
| PRT-15 Ondernemer stelt aanbod voor | nu | klein | laag | besluit over soort `geld` |
| PRT-11 Stukken aanleveren | nu | middel | midden | `docs.bestanden` |
| PRT-12 Subsidie één bron | nu | middel | midden | `subsidies.js`, eenmalige koppeling |
| PRT-13 Export | nu | middel | midden | PRT-05 |
| PRT-09 Meerdere medewerkers | later | middel | midden | besluit grens met `werk.organisatie` |
| PRT-18 Berichten | later | middel | midden | `comm.berichten` |
| PRT-19 Mijn codes | later | klein | laag | stabiliteit van de koppelsleutel |
| PRT-16 Fiscale verwijzing | later | klein | laag | fiscale laag zaakkant |
| PRT-14 MBC-impactbeeld | later | groot | hoog | indicatoren, eigenaarsbesluit methode |
| PRT-20, PRT-21, PRT-22 | niet doen | — | — | huisregels |
| PRT-01–04, PRT-06, PRT-07 | bestaat | klein | laag | onderhoud |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket: PRT-05, PRT-08, PRT-10, PRT-17, PRT-15, PRT-11, PRT-12, PRT-13. Geen nieuwe motor: de drempel is de bestaande functie, intrekken volgt het bestaande patroon, stukken en subsidie lopen via verwijzingen.

Wat de gebruikers daarna kunnen dat ze nu niet kunnen:
- *De gemeente* krijgt een portaal waarin geen enkel klein getal meer staat of af te leiden is, ziet haar opdracht met de echte stand van de subsidie (rapportagemomenten, verantwoordingsdatum) en neemt een export mee naar de raad die gelijk is aan het scherm.
- *De stichting* ziet wat in haar dossier ontbreekt of verloopt (overeenkomst, verwerkersafspraak, verzekering, VOG-beleid), levert zelf stukken aan die het kantoor aftekent, en erkent genootschappen die haar vroegen.
- *De ondernemer* stelt zelf nieuw aanbod voor in plaats van te bellen.
- *Het kantoor* kan een toegang intrekken zonder meteen een nieuwe code te moeten uitgeven.

### Uitkomst B — het domeinmaximum

Het eindproduct: het samenwerkingsportaal waarin een stichting, een gemeente en een ondernemer hun hele samenwerking met de foundation doen — van aanmelding tot verantwoording — terwijl de foundation de enige is die dossiers ziet en de buitenwereld alleen tellingen.

Nieuwe professionele processen:

1. **Partneronboarding van aanmelding tot actief** (rol: bestuurder of coördinator van de stichting; kantoor: partnerbeoordelaar; landelijk: goedkeurder). Stappen: aanmelding met KvK-gegevens (klaargezet) → stukken aanleveren (PRT-11) → toetsing door de stad (`in_toetsing`) → landelijke goedkeuring → ondertekening van de overeenkomst → actief. Nodig: een publieke aanmeldroute voor stichtingen (**eigenaarsbesluit**: wie mag een dossier openen zonder code?), digitale ondertekening (**extern, eigenaarsbesluit**), eventueel een KvK-opvraging (**extern, eigenaarsbesluit**; RTG valideert niet inhoudelijk en doet niet alsof).
2. **Verwerkersovereenkomst of gezamenlijke-verantwoordelijkheidsregeling per partner** (rol: privacycontactpersoon stichting; kantoor: privacyfunctionaris). Stappen: veld `persoonsgegevens` bepaalt het model (partner = verantwoordelijke, rtf = verwerker, samen = gezamenlijk) → model klaarzetten met de art. 28-onderwerpen → beide kanten bevestigen → datum en herzieningsmoment in het dossier → melding bij verloop. Nodig: modelteksten (**juridisch, eigenaarsbesluit**), geen eigen juridisch oordeel van RTG (klasse "voorbehouden" waar het een juridische kwalificatie is).
3. **Subsidieaanvraag en -vaststelling met de gemeente** (rol: subsidieadviseur gemeente; stichting/RTF als aanvrager). Stappen: kans → aanvraag klaarzetten met begroting → indienen (één bevestiging; RTG dient niet zelf in) → verlening (extern) → rapportagemomenten → verantwoording met bewijs → vaststelling door de gemeente (extern) → eventueel terugvordering. Nodig: aanvraagformat per gemeente (extern), accountantsverklaring boven een drempel (extern), **eigenaarsbesluit** of de gemeente in het portaal een vaststelling mag vastleggen (dat is een handeling van een bestuursorgaan; RTG legt alleen vast dat het gebeurde).
4. **Prestatieafspraken en kwartaalrapportage Wmo/Jeugdwet-voorliggend veld** (rol: contractmanager gemeente). Stappen: KPI's afspreken → kwartaal: getelde stand automatisch uit `cijfersVan` met drempel → toelichting door RTF → gemeente bevestigt ontvangst. Nodig: vaste KPI-woordenlijst per stad (**eigenaarsbesluit**), geen individuele trajecten.
5. **Maatschappelijke business case per project** (rol: beleidsonderzoeker gemeente of RTF-impactanalist). Stappen: interventie en referentiescenario → kosten en baten per partij met bron → doorrekenen als scenario → jaarlijks herijken met gemeten indicatoren. Nodig: methode (geen landelijke standaard volgens de zoekresultaten; **eigenaarsbesluit** welke), een rekenmodel binnen de bestaande rapportlaag (een nieuw model is een **besluit**), altijd "scenario".
6. **Maatschappelijk verantwoord ondernemen als programma** (rol: MVO-verantwoordelijke van een lokaal bedrijf). Stappen: jaarplan met aanbod (maaltijden, stages, vervoer) → koppeling aan projecten → kwartaalterugkoppeling (impact) → jaarverklaring van RTF "dit is wat u bijdroeg" (geteld, geschatte waarde als schatting). Nodig: verklaringsformat; fiscale kant alleen via de vier klassen; stageplekken voor jongeren: geen progressie onder 18, wel leerdossier onder de vier voorwaarden; **eigenaarsbesluit** of soort `geld` hier hoort of in Geven.
7. **Werknemersvrijwilligerswerk van een bedrijf** (rol: HR van het bedrijf; vrijwilligers zijn de medewerkers). Stappen: inzetdag aanbieden → medewerkers melden zich individueel via het vrijwilligersportaal (eigen account, eigen VOG waar nodig) → uren bevestigd door de stad → bedrijf ziet alleen het totaal (vanaf K deelnemers). Nodig: groepskoppeling bedrijf ↔ vrijwilligers zonder dat het bedrijf individuen volgt (**eigenaarsbesluit**; geen capaciteitscijfer op een mens).
8. **Convenant gegevensdeling met de gemeente voor geaggregeerd onderzoek** (rol: onderzoeker gemeente). Stappen: doel per onderzoek → toestemming per doel (LEVEN par. 2.6) → alleen geaggregeerde tabellen met harde ondergrens → publicatie. Nodig: **eigenaarsbesluit**, juridisch convenant (extern); bij twijfel gaat het niet naar buiten.
9. **Externe koppelingen** (alle **besluit**): ondertekenplatform, KvK-register, eHerkenning voor gemeentemedewerkers in plaats van een gratis account, uitwisselformaat naar gemeentelijke subsidiesystemen.

Huisregels blijven ook in B: geen dossier of naam naar de gemeente, geen ranglijst van bedrijven of vrijwilligers, bevestigen doet de mens (RTG dient niets in namens een organisatie), fiscale uitspraken in vier klassen, de beschermingsdeur ligt buiten dit portaal en blijft open.

### Ketens LOS en SAMEN

**LOS.** Staan de andere apps uit, dan blijft de kerntaak volledig: met account en code het eigen dossier lezen — de stichting haar afspraken en projecten, de gemeente haar getelde cijfers en opdrachten, de ondernemer zijn aanbod. Alles komt uit `rtfos`. Het scherm zegt eerlijk wat er niet is: "Stukken aanleveren is nu niet beschikbaar; mail ze aan het kantoor" (zonder Bestanden), "Berichten zijn uit; bel het RTF-kantoor" (zonder Berichten), en bij het genootschapsblok zonder genootschapsdomein: "Deze functie is tijdelijk niet beschikbaar".

**SAMEN — keten "subsidie van de gemeente tot verantwoording".**
1. Kantoor legt de gemeente vast en geeft een RTFG-code uit (`kantoor.rtfbeheer`, `gemeente.maak`).
2. Gemeentemedewerker maakt een gratis account (`account.registratie`) en opent het portaal met de code; zijn account wordt gekoppeld (`portaal.toegang`, `codekoppel.js`).
3. Kantoor zet de subsidie op toegekend; de geoormerkte bron ontstaat (`subsidies-keten.js`, `geld.js`, kantoor).
4. Opdracht in het portaal verwijst naar de subsidie (PRT-12); gemeente ziet bedrag en rapportagemomenten (Portaal).
5. Projecten draaien en vullen indicatoren (kantoor/veld, `os-veld.html` `werk.veldwerk`); buurt ziet de activiteiten (`wereld.foundation`).
6. Gemeente leest getelde cijfers met drempel (Portaal, PRT-05) en exporteert de verantwoording (PRT-13).
7. Kantoor zet de subsidie op verantwoord zodra alle momenten af zijn en er bewijs is (kantoor).

Storingen:
- *Code onderschept en door een vreemde eerst geopend (stap 2):* de echte medewerker krijgt 404; het kantoor roteert (`coderoteer.js`), de oude koppeling vervalt; niemand heeft meer gezien dan het getelde gemeentebeeld.
- *Sessie verlopen (stap 2):* 401, `RTGAccountDeur.vergeet()`, opnieuw inloggen; de code moet opnieuw worden ingevoerd (staat niet in de browser).
- *Subsidiemodule onbereikbaar (stap 3/4):* de opdracht toont "stand van de subsidie nu niet beschikbaar" en géén eigen bedrag als vervanging.
- *Geen indicatoren ingevuld (stap 5):* "niet gemeten", nooit 0.
- *Drempel kan niet veilig samenvoegen (stap 6):* "overige buurten" zonder getal met de reden; de export doet hetzelfde.
- *Open rapportagemoment (stap 7):* status gaat niet naar verantwoord; de gemeente ziet "1 moment open".

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | stichting, gemeente en ondernemer kunnen elk lezen én één ding klaarzetten (stuk, export, aanbod) | voltooiproef `rtfportaal.js` uitgebreid met PRT-11, PRT-13, PRT-15 |
| professionele diepte | elke subsidie in het gemeenteportaal toont momenten, verantwoordingsdatum en status uit `subsidies.js`, en er bestaat geen tweede bedrag | toets die opdrachten zonder subsidieverwijzing maar met bedrag > 0 laat zakken |
| levenscyclus | een partner doorloopt aangemeld → actief → verlopen met de juiste zin per stap, en een verlopen document valt op | scenario met datumverschuiving |
| samenwerking en rollen | twee medewerkers per dossier, elk intrekbaar, en een ander account ziet 404 | BEVOEGD-kruisparen per code; IDOR met een echte id van A (niet meer "onbereikbaar") |
| domeinintelligentie | geen getal onder K, en geen verborgen getal af te leiden uit totaal minus getoond, voor buurten, soorten en projecten | mutatietoets naar het model van `buurtdrempel` (getal 1 injecteren, moet verdwijnen) |
| los functioneren | met Bestanden, Berichten en Genootschap uit blijven de drie portalen lezen en zegt elk blok eerlijk dat het uit is | proef met uitgeschakelde verwijzingen |
| RTG-ketens | de keten "subsidie tot verantwoording" sluit, met elke storing hierboven en de genoemde zin | ketenproef met foutinjectie |
| bewezen betrouwbaarheid | de acht APPWERKT-bewijzen BEWEZEN, IDOR gemeten op alle portaalroutes, en geen veld uit de verbodslijst (iban, kvk, rsin, bestuurders, beoordeling, codenaam, dossier) in een portaalantwoord | APPWERKT.json, IDOR.json, `rtfportaal.js` |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | wat RTF Portaal alleen verwijst |
|---|---|---|
| account maken | `account.registratie` → `apps/foundation/registreren.html` | via `RTGAccountDeur` |
| bestanden opslaan | `docs.bestanden` → `apps/bestanden.html` | verwijzing in het dossier; geen tweede documentopslag (zoals `partners.js` al zegt) |
| berichten | `comm.berichten` → `apps/comm.html` | draad-id |
| genootschap | `sociaal.genootschap` → `apps/genootschap.html` | erkennen in Portaal, leden en werking daar |
| stadsraad met partners | `bestuur.stadsraad` → `apps/foundation/partner.html` | twijfel: verhouding tot het partnerportaal aan de integrator voorleggen |
| kantoorbeheer van dossiers, subsidies, codes | `kantoor.rtfbeheer` → `apps/foundation/kantoor.html`; `kantoor.governance` → `apps/foundation/os-bestuur.html` | Portaal schrijft niets dat het kantoor beslist |
| vrijwilligers van een partner of bedrijf | `werk.vrijwilligerswerk` → `apps/foundation/os-vrijwilliger.html` | link; VOG en uren daar |
| hulpvragers | `hulp.aanvraagstatus` → `apps/foundation/os-deelnemer.html` | RTFD-code wordt doorgewezen |
| donateursoverzicht en geldgiften | `gift.overzicht` → `apps/foundation/os-donateur.html`; `geven.doneren` → `apps/foundation/geven.html` | aanbod van soort `geld`: twijfel, aan de integrator voorleggen |
| de ondernemer als zaak (administratie, fiscaal) | `werk.organisatie` → `apps/werk.html`; `zaak.partnernetwerk` → `apps/partner-network.html` | verwijzing; fiscale antwoorden via `kern/fiscaal/zekerheid.js` |
| burgerkant van de gemeente | `overheid.gemeente-burger` → `apps/gemeente.html`; `overheid.loketbeheer` → `apps/gemeenteloket.html` | geen verband met de RTFG-code; twijfel of de gemeentemedewerker hier één identiteit zou moeten hebben: aan de integrator voorleggen |
| betalen | `betalen.rtgpay` → `apps/pay.html` | Portaal toont geen betaling en doet er geen |
| buurtkant | `wereld.foundation` → `apps/foundation/os-publiek.html` | projecten die de gemeente ziet, ziet de buurt op posterniveau |


---

## 8. RTF Bord — `link:rtfbord`, `/apps/foundation/bord.html`

RTF Bord is de docentkant van een live les van de RTFoundation: een digitaal schoolbord voor een begeleider (ouder, bijlesgever, vrijwilliger of leerkracht) die met een gratis RTG-account een les start en een lescode deelt. Hij kan tekenen, opgaven en agendapunten klaarzetten, zien wie er is en wat er is ingeleverd, en het schrift van een leerling lezen. De kern is een kortdurende les (alle sleutels vervallen na twaalf uur), met credentials van 128 bits die alleen als hash zijn opgeslagen, en een strikte scheiding tussen de rollen leraar en leerling. Bord en Schrift zijn twee kanten van dezelfde les en geen doublure (SCHERMEIGENAAR.json: klasse "geen-dubbel").

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | NIET_GETEST | n.v.t. | Het scherm hangt achter een tijdelijke schoolpas (commentaar in `bord.html`, 19 augustus 2026). |
| bedienbaar | NIET_GETEST | n.v.t. | |
| menselijk | NIET_GETEST | 3 stappen menselijk-afgeleid gesloten | |
| voltooibaar | GEEN_FIXTURE | 8 stappen gesloten (`scripts/lib/voltooi/rtfbord.js`) | De live stroom (SSE) en de presentielijst lopen niet mee (de `grens` van de proef). |
| waarheidsgetrouw | NIET_GETEST | n.v.t. | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | herstart, opslaglezer, kind ziet hetzelfde bord |
| bevoegd | BEWEZEN | 4 bevoegdheidsstappen binnen de 8 | IDOR: niet gemeten. BEVOEGD: 4/5 kruisparen gescheiden. |
| herstelbaar | GEEN_FIXTURE | 4 stappen gesloten | dubbele tik op + en op Zet, afgebroken opgave, crash na een streek |

**Wat de code doet (gelezen):**

- `server/foundation/onderwijs.js`:
  - `lesVan()` zet een verzoek om in een les plus een rol;
  - de rem op het raden van een lescode staat op 20 pogingen per 10 minuten per adres, vóór de opzoeking;
  - een sleutel in het adres wordt geweigerd (`?token=`, B25);
  - `docentCheck` en `leerlingVan` controleren de rol;
  - presentie gaat via SSE en alleen naar de docent;
  - oude lessen van vóór v2 worden geruimd.
- `onderwijs/les.js`:
  - `/les/maak` vraagt een account (`lesaccount.js`, besluit van 19 oktober), met een rem van 20 per uur per adres en een herhaalsleutel;
  - `/les/join` vraagt een account of een gezinsprofiel; een dubbele naam geeft 409;
  - `/les/stroomticket` geeft een eenmalig ticket van 30 seconden;
  - `/les/:code/stream` levert de SSE-stroom;
  - de bordroutes zijn `stroke` (pen, marker of gum; kleur `#rrggbb`; dikte 1–60; ≤1500 punten), `wis`, `undo` en `GET /bord/:code`;
  - een bord houdt maximaal 8000 streken.
- `onderwijs/lesbeheer.js`: de lescode roteren of intrekken, een leerling intrekken en de les sluiten. Elk beheer wordt binnen de collectietransactie opnieuw gecontroleerd (`toegang-beheer.js`). Bij intrekken of sluiten gaan ook de open stromen dicht.
- `onderwijs/toegang.js`: drie credentials (lescode, leraar, leerling), 128 bits uit `kern/bearercode`. Ze vervallen na 12 uur. Een klas heeft maximaal 60 leerlingen. De hashes worden nog 30 dagen bewaard. In productie weigert de laag zonder collectietransactie.
- `onderwijs/schrift.js` (docentkant):
  - `/opgave` met `idem`; een conflict geeft 409;
  - `/opgaven/:code` toont de inzendingen op naam;
  - `/schrift/:code/:studentId` laat het schrift van een leerling lezen;
  - `/agenda` en `/agenda/verwijder`, met maximaal 60 punten.
- Scherm `bord.html`:
  - gereedschappen pen, marker en gum, met kleur, dikte, ongedaan maken en wissen;
  - de lescode met "Kopieer" en "Nieuwe lescode" (roteer);
  - deellink en QR via `lesdeel.js`, met de code alleen in het fragment `#les=` naar `apps/foundation/leren.html`;
  - opgaven met het aantal ingeleverd;
  - de agenda;
  - de leerlingenlijst met een stip voor online, het aantal ingeleverd en "bekijk schrift".
- **Niet op het scherm (gelezen in `bord.html`):** lescode intrekken, leerling intrekken en les sluiten. De routes bestaan wel.
- **Niet gevonden:** een route voor terugkoppeling op een inzending, en een opruiming van de inhoud van `F().lessen` (bord, schriften, namen) na afloop. Alleen de credentials hebben een bewaartermijn van 30 dagen. Ik heb niet vastgesteld of de opruiming elders staat.
- **Namen:** een leerling geeft bij meedoen een vrije naam op (≤40 tekens), die de begeleider ziet en die in `F().lessen` wordt opgeslagen. Dat is geen codenaam (vergelijk SCHOOL.md par. 11.11).

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Classroomscreen | Basic, Pro, Organization (duurste) | Basic gratis; Pro $3/mnd of $36 per jaar; Organization: prijs onleesbaar of op aanvraag, vanaf 5 licenties | klasscherm-widgets, licenties per docent, herverdeelbaar | Classroomscreen — https://classroomscreen.com/pricing/ ; Help — https://help.classroomscreen.com/article/62-pricing-information-school-pro (zoekresultaat 2026-10-19, pagina niet geopend) |
| Nearpod | Silver, Gold, Platinum, School & District (duurste) | Gold $159/jaar; Platinum $397/jaar; School & District op offerte | live lessen, sessies tot 75/90/250 leerlingen, AI-vraaggenerator, studentnotities (Platinum), beheerdashboards, LMS-rostering | Nearpod — https://nearpod.com/pricing.md (zoekresultaat 2026-10-19, pagina niet geopend); https://nearpod.com/formative-assessment (eerdere zoekresultaten) |
| Google Classroom (Workspace for Education) | Fundamentals, Standard, Plus (duurste) | Education Plus: adviesprijs $6 per gebruiker per jaar (eerder $5); afname voor de hele leerlingpopulatie | opdrachten, klassen, beheer | Google — https://support.google.com/a/answer/14206754 (zoekresultaat 2026-10-19, pagina niet geopend); https://support.google.com/edu/classroom/answer/15605102 (eerdere zoekresultaten) |
| Miro Education | Education-plan | gratis voor erkende instellingen (docent: team van 100, onbeperkt geldig) | onbeperkte borden, stemmen, timer, sjablonen, export; beperkte AI | Miro — https://help.miro.com/hc/articles/360017730473 (zoekresultaat 2026-10-19, pagina niet geopend) |
| Khan Academy Districts | Enterprise Starter, Enterprise | geen gegevens van Khan zelf | docent-AI, rapportage, rostering | Khan — https://support.khanacademy.org/hc/da/articles/42088251619213 (zoekresultaat 2026-10-19, pagina niet geopend) |

**Welke kernfuncties wij hebben:**

| functie | stand |
|---|---|
| live bord | ja |
| deellink of QR | ja |
| opgaven klaarzetten | ja, alleen open tekst |
| inzendingen zien | ja |
| leerlingwerk meelezen | ja |
| presentie | ja |
| agenda | ja |
| meerdere bordpagina's, tekst, vormen of afbeelding op het bord | nee |
| terugkoppeling op werk | nee |
| meerkeuze of formatieve vragen | nee (bestaan in `rtf.klas` en `leren.lesmaker`) |
| co-docent | nee |
| les hergebruiken of sjablonen | nee |
| les sluiten of leerling intrekken op het scherm | half (alleen de routes) |
| beheerdashboard voor een organisatie | nee |
| rostering of LMS | nee (dat hoort bij `werk.schoolbeheer`) |
| prijs | gratis en zonder lidmaatschap; een gratis account is genoeg |

### c. Het volledige domein

**Particulier.** Ouders helpen met huiswerk aan de keukentafel. Grootouders of familie geven op afstand uitleg. Oudere broers of zussen helpen jongere. Er is geen formele relatie en vaak één kind.

**Professioneel.**
- *Leerkrachten (po/vo)* werken binnen het leerlingvolgsysteem en het LMS van de school, en het bevoegd gezag sluit de verwerkersovereenkomst.
- *Bijlesgevers en huiswerkbegeleiders* (aanvullend onderwijs) werken per leerling of kleine groep, vaak tegen betaling. Een **wetsvoorstel** regelt een VOG-plicht voor particuliere aanbieders van aanvullend onderwijs (bijles, huiswerkbegeleiding, studievaardigheden), met een jaarlijkse controle door het bevoegd gezag. De VOG-plicht "geldt nu niet". Of de wet inmiddels van kracht is, kon ik niet bevestigen. Tweede Kamer — https://www.tweedekamer.nl/kamerstukken/plenaire_verslagen/kamer_in_het_kort/verplichte-vog-aanvullend-onderwijs ; kst 36479 — https://zoek.officielebekendmakingen.nl/kst-36479-3.pdf (zoekresultaat 2026-10-19, pagina niet geopend).
- *Brancheorganisaties en keurmerken:* NRTO-leden moeten binnen een jaar het NRTO-keurmerk halen, via een externe audit (KIWA, CPION, CIOO); er is een nieuwe norm voor 2026. Het LVSi-keurmerk vraagt een VOG. NRTO — https://www.nrto.nl/wp-content/uploads/Norm-NRTO-keurmerk-DEF-2026.pdf (zoekresultaat 2026-10-19, pagina niet geopend).
- *Vrijwilligers* (buurthuis, taalmaatje) werken onder een organisatie, vaak met een VOG (`werk.vrijwilligerswerk` toont de geldigheid van de VOG).

**Organisatorisch.**
- Een school die digitale leermiddelen gebruikt, sluit een verwerkersovereenkomst. Het Convenant Digitale Onderwijsmiddelen en Privacy kent een model-verwerkersovereenkomst; een bron noemt versie 4.0 (2024) en een algemene variant voor leveranciers die zich niet bij het convenant hebben aangesloten. Wikiwijs (model 2.0) — https://maken.wikiwijs.nl/bestanden/614307/Model%20Bewerkersovereenkomst%202.0.pdf ; Convenant 2.0 — https://www.derolfgroep.nl/wp-content/uploads/2018/01/Convenant-Digitale-Onderwijsmiddelen-en-Privacy-2.0.pdf (zoekresultaat 2026-10-19, pagina niet geopend). De actuele versie heb ik niet bij privacyconvenant.nl zelf bevestigd.
- Het leerlingdossier van de school (WPO/WVO) en de bewaartermijnen volgen de selectielijst onder de Archiefwet. Een specifieke termijn voor het leerlingdossier heb ik niet gevonden. Archive-IT whitepaper — https://www.archive-it.nl/cdn/c98f1bc5-507e-4237-a5c3-a4d7129bcae7/whitepaper-onderwijs-nl.pdf ; VO-raad — https://vo-raad.nl/nieuws/archiefwet-wettelijke-bewaartermijnen-voor-openbaar-gezagtaken (zoekresultaat 2026-10-19, pagina niet geopend).

**Wat volgt voor de app:**

1. Een RTF-les is **geen schoolleerlingdossier** en mag dat niet worden. Wat een school vastlegt, hoort bij School (`werk.schoolbeheer`, `rtf.school`), niet bij het bord.
2. Een begeleider die een les geeft aan kinderen die hij niet kent, is precies de situatie waarvoor de VOG-plicht bedoeld is. Daarvoor ontbreekt in dit huis een genre met persoonseis (alleen `kinderopvang` heeft identiteit plus VOG).
3. Inhoud van de les (namen, schriften) heeft een bewaartermijn nodig. "Registratie verdwijnt niet" (SCHOOL.md par. 11.10) geldt voor School, niet voor een losse bijles.
4. Geen surveillance: klassikaal inzicht alleen uit het leerproces zelf (SCHOOL.md par. 11.6).

### d. Functiecatalogus L1–L6

Oordeel per laag:
- **L1 Persoonlijk (de begeleider zelf):** sterk. Bord, opgaven, agenda en lescode staan en zijn in de voltooiproef bewezen.
- **L2 Professioneel via bestaande genres:** afwezig. Er is geen genre voor bijles of huiswerkbegeleiding, en een begeleider is "een account".
- **L3 Organisatorisch:** afwezig. Geen co-docent, geen organisatie, geen klasreeks.
- **L4 Domeinintelligentie:** dun. Presentie en het aantal ingeleverd, geen terugkoppeling, geen gegroepeerd beeld.
- **L5 Volledige levenscyclus:** half. Maken, delen en roteren staan. Sluiten staat niet op het scherm, en afronden en opruimen ontbreken.
- **L6 RTG-samenhang:** dun. Alleen de ingang via Leren & Groei (`leren.html`) en de gedeelde realtimelaag.

**BRD-01 Les starten met account; lescode, deellink en QR** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/les/maak`, `toegang.nieuweLes` en `lesdeel.js`.
- Regels en rekenwijze: 128 bits; de code reist alleen in het fragment; 20 lessen per uur per adres.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen wie de code krijgt.
- Rollen en toestemming: een ingelogd account (gratis is genoeg).
- Uitzonderingen: geen account geeft 401 "Log in met je RTG-account". Een herhaling met dezelfde `idem` geeft 409 zonder de codes opnieuw te tonen.
- Acceptatiecriterium: Gegeven een begeleider met een gratis account, wanneer hij een les maakt en de QR toont, dan opent een leerling met een account de les zonder de code in te tikken, en staat de code in geen enkele serverlog.

**BRD-02 Tekenen op het bord, live naar de klas** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/bord/stroke`, `wis` en `undo`, plus SSE.
- Regels en rekenwijze: alleen de leraarsleutel van deze les. Maximaal 8000 streken; de oudste vallen eraf.
- Onzekerheid: de SSE-stroom is niet in de voltooiproef gemeten.
- Wie hoort wat, wanneer: de leerlingen direct.
- Rollen en toestemming: een leerling tekent niet op het bord (proef: 403).
- Uitzonderingen: valt de stroom weg, dan haalt `GET /bord/:code` het hele bord opnieuw op.
- Acceptatiecriterium: Gegeven een les met twee leerlingen, wanneer de begeleider drie streken zet en er één terugneemt, dan zien beide leerlingen er twee.

**BRD-03 Opgave klaarzetten** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/opgave` (≤600 tekens) met een herhaalsleutel.
- Regels en rekenwijze: dezelfde `idem` met dezelfde tekst geeft "herhaald"; met een andere tekst 409.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de leerlingen direct, via het SSE-event `opgave`.
- Rollen en toestemming: alleen de leraar.
- Uitzonderingen: een lege tekst geeft 400.
- Acceptatiecriterium: Gegeven een dubbele tik op "Zet klaar", dan staat de opgave één keer bij de leerlingen.

**BRD-04 Agenda van de les** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/agenda`, `/agenda/verwijder`; maximaal 60 punten.
- Regels en rekenwijze: met herhaalsleutel. Een datum is vrije tekst (≤20 tekens).
- Onzekerheid: de datum wordt niet als datum gecontroleerd.
- Wie hoort wat, wanneer: de leerlingen direct.
- Rollen en toestemming: alleen de leraar.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven twee punten, wanneer er één wordt verwijderd, dan zien de leerlingen er één.

**BRD-05 Presentie, inzendingen en schrift meelezen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `presentie()` (online plus aantal ingeleverd), `/opgaven/:code` en `/schrift/:code/:studentId`.
- Regels en rekenwijze: alleen de leraar van deze les. Het aantal ingeleverd is een telling binnen de les en geen score.
- Onzekerheid: "online" betekent dat er een open stroom is, niet dat iemand oplet. Zo moet het scherm het ook zeggen.
- Wie hoort wat, wanneer: alleen de begeleider.
- Rollen en toestemming: de begeleider van een andere les krijgt niets (proef).
- Uitzonderingen: een ingetrokken leerling verdwijnt uit de lijst.
- Acceptatiecriterium: Gegeven een leerling die heeft ingeleverd, wanneer de begeleider "bekijk schrift" kiest, dan ziet hij het schrift van die ene leerling. De begeleider van een andere les krijgt 403.

**BRD-06 Lesbeheer op het scherm: code intrekken, leerling intrekken, les sluiten** · L5 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de routes in `lesbeheer.js`; op `bord.html` staat alleen roteren.
- Regels en rekenwijze: binnen de collectietransactie wordt opnieuw gecontroleerd, en de stromen gaan dicht.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de ingetrokken leerling ziet "toegang ingetrokken" en verder niets.
- Rollen en toestemming: alleen de leraar.
- Uitzonderingen: een gesloten les geeft 410.
- Acceptatiecriterium: Gegeven een leerling die stoort, wanneer de begeleider hem intrekt, dan sluit zijn stroom direct, kan hij niet meer inleveren, en ziet de rest van de klas niets daarvan.

**BRD-07 Terugkoppeling op een inzending (woorden, geen cijfer)** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: een nieuw veld bij de inzending in `F().lessen` (`o.inzendingen[id].terug`).
- Regels en rekenwijze: alleen tekst. Geen cijfer, geen sterren, geen goed/fout-telling over leerlingen heen.
- Onzekerheid: n.v.t.
- Wie hoort wat, wanneer: alleen die leerling, via SSE gefilterd op `studentId`.
- Rollen en toestemming: alleen de leraar. Versturen is één bevestiging, want het bereikt een tweede mens.
- Uitzonderingen: een ingetrokken leerling krijgt niets meer.
- Acceptatiecriterium: Gegeven twee leerlingen die hebben ingeleverd, wanneer de begeleider leerling A terugkoppeling stuurt, dan ziet A die in zijn schrift en ziet B niets.

**BRD-08 Rijker bord: meerdere pagina's, tekst, vormen, een afbeelding of een PDF-pagina** · L1 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: een uitbreiding van `les.bord` naar `bladen[]`; afbeeldingen als data-URL met dezelfde grens als de bordfoto (<3e6 tekens).
- Regels en rekenwijze: gelijke vorm als de schriftbladzijden, zodat de bordfoto ze kan dragen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de klas.
- Rollen en toestemming: alleen de leraar. Een afbeelding van een derde valt onder de Auteurswet; het scherm zegt dat de begeleider verantwoordelijk is voor wat hij toont.
- Uitzonderingen: een te groot bestand wordt geweigerd met reden.
- Acceptatiecriterium: Gegeven een bord met twee pagina's, wanneer de begeleider naar pagina 2 gaat, dan zien de leerlingen pagina 2. Een herstart bewaart beide pagina's.

**BRD-09 Een gecontroleerde begeleider (identiteit en VOG)** · L2 · ontbreekt · aanbevolen later (eigenaarsbesluit)
- Gegevens en bron: `persoonseis.js` kent een VOG alleen in het genre `kinderopvang`. Een genre "aanvullend onderwijs" bestaat niet.
- Regels en rekenwijze: dezelfde reikwijdte "werk" als bij kinderopvang. Een VOG verloopt en wordt bij elke vraag opnieuw gerekend. RTG tekent af en valideert niet inhoudelijk.
- Onzekerheid: de wettelijke VOG-plicht is een wetsvoorstel met een onbevestigde status.
- Wie hoort wat, wanneer: de ouder ziet dat de begeleider "gecontroleerd" is, maar niet het VOG-nummer (dat staat in de kluis).
- Rollen en toestemming: **besluit 6** staat alleen bestaande genres toe, dus een nieuw genre is een eigenaarsbesluit.
- Uitzonderingen: een ouder die zijn eigen kind bijles geeft, heeft geen VOG nodig.
- Acceptatiecriterium: (na het besluit) Gegeven een begeleider met een verlopen VOG in het genre, wanneer hij een les wil maken voor leerlingen buiten zijn gezin, dan krijgt hij "uw VOG is verlopen" en blijft zijn account bestaan.

**BRD-10 Les als sjabloon bewaren en hergebruiken** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: het bord, de opgaven en de agenda zonder leerlingen, bewaard onder het account van de begeleider.
- Regels en rekenwijze: er gaat geen leerlingdata in het sjabloon.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de begeleider.
- Rollen en toestemming: eigen account.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een gesloten les, wanneer de begeleider "bewaar als sjabloon" kiest en morgen een nieuwe les start, dan staan het bord en de opgaven klaar en zijn de lijst, de inzendingen en de schriften leeg.

**BRD-11 Co-begeleider (tweede leraarsleutel)** · L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: een tweede credential met het doel `foundation-les-leraar` (`toegang.js`).
- Regels en rekenwijze: dezelfde scope `les.leiden`, apart intrekbaar.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de klas ziet twee begeleiders.
- Rollen en toestemming: de eerste begeleider nodigt uit met één bevestiging.
- Uitzonderingen: de co-begeleider kan de eerste niet intrekken.
- Acceptatiecriterium: Gegeven een co-begeleider, wanneer de eerste begeleider hem intrekt, dan sluit zijn stroom en kan hij niets meer.

**BRD-12 Les koppelen aan een klas in School (verwijzing)** · L3 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: `server/school/` (klas, les) is eigenaar. Het bord krijgt alleen een `klasCode`-verwijzing.
- Regels en rekenwijze: geen tweede leerlingenlijst (SCHOOL.md par. 14). De leerlingen komen uit School en doen mee op codenaam.
- Onzekerheid: hangt af van de verwerkersovereenkomst met de school (extern).
- Wie hoort wat, wanneer: School bepaalt het.
- Rollen en toestemming: de rollen uit `school/rollen.js`, geen tweede model.
- Uitzonderingen: zonder school blijft de les los.
- Acceptatiecriterium: Gegeven een les met een klasverwijzing, wanneer een leerling van die klas meedoet, dan draagt hij zijn codenaam en geen vrij ingetypte naam.

**BRD-13 Klassikaal beeld: bezig, ingeleverd, vraagt hulp** · L4 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de presentie en de inzendingen bestaan. De hulpvraag ontbreekt (SCH-09).
- Regels en rekenwijze: alleen telling en lijst op naam, nooit op zwaarte (SCHOOL.md par. 11.1 en 11.6).
- Onzekerheid: "bezig" is niet gemeten; alleen "online" en "ingeleverd".
- Wie hoort wat, wanneer: alleen de begeleider, tijdens de les.
- Rollen en toestemming: leraar.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven drie leerlingen, van wie één hulp vraagt, wanneer de begeleider kijkt, dan staat er "1 vraagt hulp" met de naam, en geen kleur of rangorde.

**BRD-14 Foutpatronen in de inzendingen groeperen (AI-voorstel)** · L4 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: alleen de antwoorden van deze opgave, zonder namen naar het model (Child Context Firewall, SCHOOL.md par. 11.4).
- Regels en rekenwijze: het model stelt groepen voor, de begeleider beslist. AI-bonnetje (par. 11.5).
- Onzekerheid: de klasse **advies**: een voorstel, geen oordeel.
- Wie hoort wat, wanneer: alleen de begeleider.
- Rollen en toestemming: werkt ook lokaal; `RTG_EXTERNE_AI_UIT=1` geeft de handmatige stand.
- Uitzonderingen: zonder model ziet de begeleider de antwoorden ongegroepeerd.
- Acceptatiecriterium: Gegeven 10 antwoorden en geen model, wanneer de begeleider "groepeer" kiest, dan zegt het scherm "zonder model niet gegroepeerd" en toont het alle antwoorden.

**BRD-15 Les afronden: samenvatting, inhoud opruimen, leerlingen hun schrift laten meenemen** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `F().lessen`. Voor de inhoud heb ik geen opruiming gevonden; alleen de credentials hebben 30 dagen.
- Regels en rekenwijze: bij sluiten krijgt de leerling een termijn (bijvoorbeeld 30 dagen, gelijk aan de hashtermijn) om zijn schrift mee te nemen (SCH-08, SCH-14). Daarna worden namen, schriften en inzendingen gewist; het bord gaat naar een sjabloon als de begeleider dat kiest.
- Onzekerheid: de juiste termijn is een besluit (twijfel: aan de integrator voorleggen).
- Wie hoort wat, wanneer: de leerlingen krijgen bij sluiten de melding met de einddatum.
- Rollen en toestemming: leraar.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een les die 31 dagen geleden is gesloten, wanneer de opslaglezer zoekt op de naam van een leerling, dan vindt hij niets.

**BRD-16 Reeks: dezelfde groep elke week** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: een les-id per sessie, met een verwijzing naar de vorige.
- Regels en rekenwijze: leerlingen met een account of gezinsprofiel doen opnieuw mee zonder nieuwe code; anonieme deelnemers niet.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de groep.
- Rollen en toestemming: leraar.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een reeks, wanneer week 2 start, dan staat de groep van week 1 klaar en kan een ingetrokken leerling niet terug.

**BRD-17 Agendapunt naar de gezinsagenda (verwijzing)** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: de agendamotor (`agenda.afspraken`, schil `apps/foundation/agenda.html`).
- Regels en rekenwijze: klaarzetten op het bord. De ouder of de leerling bevestigt de overname in de eigen agenda.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het gezin, pas na de bevestiging.
- Rollen en toestemming: de gezinsagenda bepaalt het.
- Uitzonderingen: zonder gezinsprofiel alleen downloaden.
- Acceptatiecriterium: Gegeven een agendapunt, wanneer de leerling niet bevestigt, dan staat het niet in de gezinsagenda.

**BRD-18 Aandachtsmeting, schermvergrendeling, tabvolgen, camera** · — · aanbevolen niet doen
- Reden: dit is surveillance van leerlingen (SCHOOL.md par. 11.6 en 14).

**BRD-19 Cijfers, sterren of ranglijst van de klas** · — · aanbevolen niet doen
- Reden: leren is geen wedstrijd. Progressie bestaat alleen voor 18+ via `progressieMag`.

### e. RTG-exclusief

1. **Bijles die bij het gezin blijft.** Leren & Groei (`rtf.leren-groei`) start de les. Bord (`rtf.bord`) geeft de les. Schrift (`leren.livesles`) is de kant van het kind. Het kind doet mee als gezinsprofiel onder het account van een ouder (`lesaccount.js`), en de ouder kan het schrift later via het gezin openen. Er worden geen gegevens gedeeld; het kind gebruikt zijn eigen leerlingsleutel.
2. **De vrijwilliger met geldige VOG als begeleider (na het besluit).** Vrijwilligerswerk (`werk.vrijwilligerswerk`) houdt de VOG-geldigheid bij. Bord vraagt alleen "geldig ja/nee" via `persoonseis`. De ouder ziet "gecontroleerd". De eigenaar van elke schakel is respectievelijk RTF-kantoor, kern/persoonseis en Bord.
3. **Van opgave naar eigen leerdossier.** Bord zet een opgave klaar. Schrift levert in. De leerling noteert zelf "geoefend" in Connect (CON-22 en SCH-16). Het bord schrijft nooit in het dossier.

### f. Bouwstenen en ontbrekende koppelingen

**Wat er staat:** `server/foundation/onderwijs.js`, `server/foundation/onderwijs/{les,lesbeheer,lesaccount,schrift,toegang,toegang-beheer,stroomticket}.js`, `public/apps/foundation/{bord.html,lesdeel.js,tekenen.js,realtime.js,sessie.js}`, `scripts/lib/voltooi/rtfbord.js`, en de toetsen `test/foundation-les*.test.js`, `test/lesstroom.e2e.js`, `test/lesdeel*.js`, `test/toegang-les.test.js`, `test/onderwijs.test.js`.

**Wat ontbreekt:**

| van → naar | vorm | wat |
|---|---|---|
| Bord → Schrift | binnen de les (SSE) | terugkoppeling (BRD-07) en hulpvraag (SCH-09) |
| Bord → `kern/persoonseis` | verwijzing (genre) | BRD-09, besluit |
| Bord → School (`server/school`) | verwijzing (`klasCode`) | BRD-12 |
| Bord → agenda (`agenda.afspraken`) | verwijzing met bevestiging | BRD-17 |
| Bord → opruiming | intern | BRD-15 |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| BRD-01 t/m 05 | onderhouden | klein | laag | APPWERKT bereikbaar en bedienbaar meten (schoolpas), IDOR meten |
| BRD-06 beheer op scherm | nu | klein | laag | geen |
| BRD-07 terugkoppeling | nu | klein | laag | SCH-10 |
| BRD-13 klassikaal beeld | nu | klein | laag | SCH-09 |
| BRD-15 afronden en opruimen | nu | middel | midden | besluit over de termijn, SCH-14 |
| BRD-08 rijker bord | nu | middel | midden | geen |
| BRD-10 sjabloon | later | middel | midden | BRD-15 |
| BRD-11 co-begeleider | later | middel | midden | `toegang.js` |
| BRD-16 reeks | later | middel | midden | BRD-10 |
| BRD-14 foutpatronen | later | middel | midden | AI-bonnetje, lokaal model |
| BRD-17 agenda | later | klein | midden | agendamotor |
| BRD-12 klas in School | later | middel | hoog | verwerkersovereenkomst met school (extern) |
| BRD-09 gecontroleerde begeleider | later | middel | midden | **eigenaarsbesluit nieuw genre**; wetsvoorstel VOG |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **"een les die af kan"**: BRD-06, BRD-07, BRD-08, BRD-13 en BRD-15, samen met SCH-09, SCH-10 en SCH-14 aan de kant van het kind. Alles blijft in `F().lessen` en de bestaande SSE-laag.

Wat de begeleider daarna kan dat hij nu niet kan:
- een les netjes sluiten en een storende deelnemer eruit halen vanaf het scherm;
- een leerling in woorden terugkoppeling geven;
- zien wie hulp vraagt;
- met meerdere pagina's en een afbeelding lesgeven;
- erop rekenen dat namen en schriften na een vaste termijn verdwijnen.

### Uitkomst B — het domeinmaximum

Bord als **lesomgeving voor het hele aanvullende onderwijs in Nederland**: bijlesinstituten, huiswerkbegeleiding, taalmaatjes, buurthuizen en scholen. Gratis voor gezinnen en premium in diepte.

Nieuwe professionele processen:

1. **Bijlesinstituut of huiswerkbegeleiding als zaak** (rollen: instituut, begeleider, planner). Het proces:
   1. intake van een leerling, met toestemming van de ouder onder de 16 (UAVG);
   2. plaatsen in een groep;
   3. een reeks lessen (BRD-16);
   4. terugkoppeling (BRD-07);
   5. een voortgangsgesprek met de ouder (`rtf.bericht`);
   6. facturatie aan de ouder (`betalen.rtgpay`, `apps/pay.html`; fiscale klasse **uitlegbaar** voor btw op onderwijs; twijfel: aan de integrator voorleggen).

   Nodig: **eigenaarsbesluit nieuw genre "aanvullend onderwijs"** met persoonseis identiteit plus VOG (reikwijdte "werk"), de wet (VOG-plicht aanvullend onderwijs, status onbevestigd), en een NRTO- of LVSi-keurmerk als bewijsstuk in `vakbewijs.js` (**besluit**: een keurmerk als vakbewijs).
2. **School als opdrachtgever van een bijlesaanbieder.** Het proces: de school huurt een aanbieder in, controleert jaarlijks de VOG (dit staat in het wetsvoorstel), en de les wordt gekoppeld aan de klas (BRD-12). Nodig: een verwerkersovereenkomst volgens het Privacyconvenant (extern), een **besluit** dat een RTF-les een schoolverwijzing mag dragen, en `werk.schoolbeheer` als eigenaar van de koppeling.
3. **Leerkracht in het reguliere onderwijs.** Het proces: lesvoorbereiding (sjabloon), de les geven, afronden in één handeling (SCHOOL.md par. 9, Teacher Flow), en het lesgeheugen voor volgend jaar. Nodig: aansluiting op School Core met rostering via Edu-V/Entree als adapter (SCHOOL.md par. 11.12, extern) en een **besluit** of Bord de docentkant van School wordt of los blijft.
4. **Taalmaatje en nieuwkomersbegeleiding** (vrijwilliger onder een organisatie). Het proces: koppeling via de organisatie, lessen met vertaalhulp (SCHOOL.md par. 8) en uren schrijven in `werk.vrijwilligerswerk`. Nodig: de vertaallaag (bestaat in School) en een **besluit** over hergebruik in Bord.
5. **Inclusief onderwijs.** Het proces: de begeleider zet aanpassingen klaar per leerling (voorlezen, groter, minder prikkels), en de leerling of ouder bevestigt. Nodig: geen nieuw genre; wel een toegankelijkheidsprofiel bij de leerling (twijfel: aan de integrator voorleggen wie dat bezit).

Een **organisatiedashboard** (meerdere begeleiders, gebruik per locatie, alleen geaggregeerd) vraagt een organisatielaag. Dat is een **besluit**, en geen cijfer per docent (SCHOOL.md par. 11.8).

### Ketens LOS en SAMEN

**LOS.** Zonder Leren & Groei, gezinsprofielen en School blijft de kerntaak: een begeleider met een account maakt een les, deelt de code en geeft les aan deelnemers met een eigen account. Het scherm zegt dan bij meedoen zonder account "Log in met je RTG-account; een gratis account is genoeg." Zonder SSE haalt het bord bij herladen alles opnieuw op; het scherm meldt dat de live-verbinding weg is (dit is een eis; ik heb niet nagelopen wat `realtime.js` toont).

**SAMEN, de keten "ouder geeft bijles aan eigen kind en een klasgenootje":**
1. De ouder opent Leren & Groei en start een live les (`apps/foundation/leren.html`, `rtf.leren-groei` → `/les/maak`).
2. Bord toont de QR (`rtf.bord`, `lesdeel.js`).
3. Het eigen kind doet mee als gezinsprofiel (`/les/join` met `gezinCode` en `gezinToken`; profiel van `gezin.beheer`).
4. Het klasgenootje doet mee met een eigen gratis account (accountregistratie).
5. De ouder zet een opgave klaar (Bord).
6. De kinderen leveren in (Schrift, `leren.livesles`).
7. De ouder leest en koppelt terug (Bord, BRD-07).
8. De ouder sluit de les (Bord, BRD-06).

**Storingen:**
- **Het klasgenootje heeft geen account (stap 4):** 401 met de uitleg. De les gaat voor de anderen door.
- **De lescode is twintig keer verkeerd ingetikt vanaf het schooladres:** tien minuten 429 voor dat adres, ook met de goede code. Dat is een bewuste keuze (`onderwijs.js`).
- **De SSE-stroom valt uit:** het bord loopt niet meer live mee; met herladen ziet de leerling het hele bord weer (`GET /bord/:code`).
- **De lescode lekt:** de begeleider roteert, de oude code opent niets meer en wie al meedoet, houdt zijn sleutel (proef).
- **De les is ouder dan 12 uur:** 403 met "verlopen of ingetrokken. Vraag je begeleider om een nieuwe lescode."
- **De server crasht na een streek:** de streek staat er na de herstart (proef).

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | meting |
|---|---|---|
| breedte | meerdere pagina's, tekst en afbeelding op het bord; opgaven met terugkoppeling | voltooistappen BRD-07 en BRD-08 |
| professionele diepte | (na het besluit) een begeleider in het genre "aanvullend onderwijs" zonder geldige VOG kan geen les buiten het eigen gezin geven | `test/persoonseis.test.js`, uitgebreid |
| levenscyclus | maken, delen, roteren, intrekken, sluiten, afronden en opruimen na de termijn zijn elk een stap | `scripts/lib/voltooi/rtfbord.js`, uitgebreid met de opslaglezer na de termijn |
| samenwerking en rollen | co-begeleider apart intrekbaar; leerling nooit leraar | BEVOEGD 5/5 (nu 4/5) |
| domeinintelligentie | klassikaal beeld alleen als telling en lijst op naam; een AI-voorstel draagt een bonnetje en de klasse "advies" | schemacontrole, handmatige stand zonder model |
| los functioneren | les met account-deelnemers werkt zonder gezinslaag en zonder School | voltooiproef met gezinslaag uit |
| RTG-ketens | de keten Leren & Groei → Bord → Schrift → sluiten loopt groen, inclusief SSE | `test/lesstroom.e2e.js` plus de voltooiproef met stroom |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN; IDOR gemeten met 0 doorbraken | APPWERKT.json, IDOR.json |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | geen dubbele logica: Bord alleen… |
|---|---|---|
| een les starten of volgen vanuit het gezin | `apps/foundation/leren.html`, `rtf.leren-groei` | is het doel van de ingang |
| huiswerk, rooster en toetsen van de echte school | `apps/foundation/school.html`, `rtf.school` | verwijst; bewaart geen huiswerk |
| schoolorganisatie, personeel, klassen | `apps/schoolpartner.html`, `werk.schoolbeheer` | verwijst met `klasCode` (BRD-12) |
| een oefenapp met AI maken en voortgang per leerling volgen | `apps/lesmaker.html`, `leren.lesmaker` | verwijst; Bord maakt geen oefenapps. `les.js` noemt dat de lesmaker een eigen teller op een gelijknamige route heeft |
| een live quiz met klascode | `apps/foundation/klas.html`, `rtf.klas` | verwijst; Bord krijgt geen tweede quizmotor |
| berichten aan ouders of begeleiders | `apps/foundation/mail.html`, `rtf.bericht` | verwijst |
| agenda | `apps/agenda.html`, `agenda.afspraken` (schil `apps/foundation/agenda.html`) | zet klaar, het gezin bevestigt (BRD-17) |
| VOG-geldigheid van een vrijwilliger | `apps/foundation/os-vrijwilliger.html`, `werk.vrijwilligerswerk` | leest "geldig ja/nee" via `persoonseis` |
| betaling van bijles | `apps/pay.html`, `betalen.rtgpay`; `apps/geld.html`, `geld.overzicht` | verwijst; Bord rekent niets af |

---


---

## 9. RTF Schrift — `link:rtfschrift`, `/apps/foundation/schrift.html`

RTF Schrift is de leerlingkant van dezelfde live les: het eigen schrift van een kind of volwassene die meedoet met een lescode, met een account of als gezinsprofiel. Het heeft vijf tabbladen: Bord (meekijken en een bordfoto in het schrift bewaren), Schrift (tekst-, teken- en fotobladzijden), Opgaven (maken en inleveren), Agenda en de AI-bijleshulp met een gekozen buddy (standaard "Rahul"). De kern is dat het schrift van de leerling is: alleen hij en de begeleider van die les lezen het. Een klasgenoot of een andere les leest het niet, en het schrift is als tekst mee te nemen.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | NIET_GETEST | n.v.t. | |
| bedienbaar | NIET_GETEST | n.v.t. | |
| menselijk | NIET_GETEST | 3 stappen menselijk-afgeleid gesloten | |
| voltooibaar | GEEN_FIXTURE | 8 stappen gesloten (`scripts/lib/voltooi/rtfschrift.js`) | De SSE loopt niet mee, en de bijleshulp antwoordt zonder model met de vaste terugval (de `grens` van de proef). |
| waarheidsgetrouw | NIET_GETEST | n.v.t. | |
| persistent | GEEN_FIXTURE | 3 stappen gesloten | herstart, opslaglezer, ingetrokken klasgenoot blijft buiten |
| bevoegd | BEWEZEN | 4 bevoegdheidsstappen binnen de 8 | IDOR: niet gemeten. BEVOEGD: 4/5. |
| herstelbaar | GEEN_FIXTURE | 4 stappen gesloten | dubbele tik op Inleveren en op Bewaar, afgebroken bewaarbeurt, crash na bewaren |

**Wat de code doet (gelezen):**

- `onderwijs/schrift.js`:
  - `/schrift/opslaan`: maximaal 60 bladzijden; tekst ≤20 000 tekens; foto als data-URL png/jpeg/webp onder 3e6 tekens; tekening ≤6000 streken;
  - `GET /schrift/:code`: alleen de eigen leerlingsleutel;
  - `/opgave/inleveren`: slaat `naam`, `antwoord` en `at` op per `studentId`; opnieuw inleveren overschrijft;
  - `/ai`: lesVan, maximaal de laatste 10 berichten van 1500 tekens. Zonder model komt een vast demo-antwoord. Met model wordt `anthropic.messages.create` aangeroepen met `SYSTEM` uit `server/foundation/basis.js` ("help met begrijpen, niet met spieken… laat de leerling de laatste stap zelf zetten") plus `leeftijdInstr(groep)` uit `foundation/buddy.js`. Of een extern model wordt gebruikt, volgt uit `server/ai.js`, dat `RTG_EXTERNE_AI_UIT=1` respecteert;
  - `/tip`: een tip per dag;
  - **daarnaast** `/reis/aanvraag` (een reisaanvraag of voordracht met rem 6 per uur), die inhoudelijk niet bij het schrift hoort.
- `onderwijs/les.js` (`/les/join`, `/les/:code`, `/bord/:code`, stroomticket) en `lesaccount.js` (meedoen met een account of gezinsprofiel).
- Scherm `schrift.html`:
  - de tabs Bord, Schrift, Opgaven, Agenda en buddy;
  - "Bewaar dit bord in mijn schrift" (bordfoto);
  - een bladzijdenstrip met tekst- en tekenblad;
  - inleveren zet het antwoord ook als tekstbladzijde in het schrift;
  - de buddy-keuze in `localStorage` (`rtf_buddy`);
  - `groep` komt uit het attribuut `data-rtf-groep` van de pagina, dus de client geeft hem mee;
  - meenemen via `RTGUitvoer` als tabel (bladzijde, soort, titel, tekst), waarbij van tekeningen en foto's alleen de titel meegaat.
- **Niet gevonden:**
  - een AI-bonnetje (SCHOOL.md par. 11.5);
  - een instructie bij de bijleshulp voor een kind dat iets onveiligs vertelt (grep op nood, hulp, veilig, 113 en Kindertelefoon in `basis.js` SYSTEM en `kern/rahul.js` RAHUL_KIND leverde niets op);
  - het laden van `/shared/uitstap.js` op `schrift.html` (wel op onder meer `pesten.html`, `onveilig.html` en `veilig.html`);
  - een hulpvraag aan de begeleider;
  - terugkoppeling.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| OneNote Class Notebook | onderdeel van een Microsoft 365-schoollicentie | geen gegevens | eigen leerlingnotitieblok (alleen leerling en docent), Content Library (alleen lezen en kopiëren), Collaboration Space (groepen, vergrendelbaar), Teacher Only | Microsoft Learn — https://learn.microsoft.com/en-us/training/modules/build-community-teams-onenote/onenote-class-notebook-build-community-learning (zoekresultaat 2026-10-19, pagina niet geopend); https://support.microsoft.com/en-us/education/onenote/class-notebook (eerdere zoekresultaten) |
| Seesaw | Seesaw LMS, Instruction & Insights (duurste: district op offerte) | derden noemen $120 per jaar, onderling tegenstrijdig over het pakket; Seesaw zelf: geen prijs in het resultaat | digitale portfolio's over jaren, school- en districtsdashboards, automatisch nagekeken formatieve toetsen, gezinscommunicatie | Seesaw — https://seesaw.com/en-gb/pricing (zoekresultaat 2026-10-19, pagina niet geopend); https://help.seesaw.me/hc/en-us/articles/115001096743-How-students-and-teachers-add-posts-to-Seesaw (eerdere zoekresultaten) |
| Nearpod Platinum | Platinum | $397 per jaar | studentnotities, sessies tot 90 | Nearpod — https://nearpod.com/pricing.md (zoekresultaat 2026-10-19, pagina niet geopend) |
| Khanmigo (leerling) | Learner-abonnement | $4 per maand (alleen VS) | AI-leerhulp | Khan — https://support.khanacademy.org/hc/da/articles/42088251619213 (zoekresultaat 2026-10-19, pagina niet geopend) |

**Welke kernfuncties wij hebben:**

| functie | stand |
|---|---|
| eigen schrift, alleen leerling en docent | ja |
| tekenen, typen en foto | ja |
| bordfoto in het schrift | ja (onderscheidend) |
| inleveren | ja |
| agenda | ja |
| AI-leerhulp die niet voorzegt | ja |
| terugkoppeling van de docent | nee |
| portfolio over lessen en jaren heen | nee: het schrift hoort bij één les van 12 uur |
| groepsruimte | nee |
| gezinsinzage | nee |
| export | half (alleen tekst) |
| voorlezen of dicteren | nee |
| offline | nee |

### c. Het volledige domein

**Particulier.** Een kind maakt huiswerk, vaak met een ouder ernaast. Het wil iets kunnen vragen zonder dat het antwoord wordt voorgezegd, en zijn eigen werk terugvinden. Ouders willen meekijken, maar het kind houdt recht op een eigen ruimte; vanaf 16 jaar beslist het zelf over toestemming (UAVG, zie Connect c).

**Professioneel.** Een begeleider leest mee en geeft terugkoppeling. In het reguliere onderwijs hoort het schrift bij het LMS van de school. Een schoolschrift is daar onderdeel van het leerproces en valt onder de verwerkersovereenkomst van het Privacyconvenant (zie Bord c).

**Organisatorisch.** De school, het bijlesinstituut of het buurthuis bepaalt hoe lang werk bewaard blijft. Voor het schoolleerlingdossier geldt de selectielijst onder de Archiefwet (zie Bord c; termijn niet gevonden).

**Regels:**
- AVG/UAVG (toestemming onder de 16);
- Auteurswet (een bordfoto van materiaal van derden is privékopie voor eigen studie; delen buiten de les niet; ik heb geen artikel gezocht);
- toegankelijkheid: een kind met dyslexie, een visuele beperking of een motorische beperking moet kunnen typen in plaats van tekenen, en moet kunnen laten voorlezen (`TOEGANKELIJK.md` is het huisdocument; niet gelezen in deze opdracht);
- huisregels: geen aandachtsmeting, geen score, een leerdossier alleen onder vier voorwaarden, en de beschermingsdeur open.

**Wat volgt voor de app:**
1. Het schrift moet kunnen blijven bestaan voorbij de les, maar alleen bij de leerling zelf, op zijn codenaam (gezinsprofiel of account) en nooit op de vrije naam die hij in de les opgaf.
2. De bijleshulp is de plek waar een kind iets kan vertellen dat niet over school gaat. Daar moet de beschermingsdeur zichtbaar zijn.
3. Terugkoppeling in woorden, nooit als cijfer.

### d. Functiecatalogus L1–L6

Oordeel per laag:
- **L1 Persoonlijk:** sterk. Schrift, bordfoto, inleveren, agenda en bijleshulp staan en zijn in de proef bewezen.
- **L2 Professioneel:** afwezig. Er is geen terugkoppeling en geen hulpvraag aan de begeleider.
- **L3 Organisatorisch:** afwezig. Geen gezinsinzage, geen groepsruimte.
- **L4 Domeinintelligentie:** half. De bijleshulp met leeftijdslaag staat, maar zonder leerdoelcontext en zonder bonnetje.
- **L5 Volledige levenscyclus:** zwak. Het schrift hoort bij één les; alleen tekstexport.
- **L6 RTG-samenhang:** dun. Geen weg naar het leerdossier, het huiswerk van School of de beschermingsdeur.

**SCH-01 Meedoen met een lescode (account of gezinsprofiel)** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/les/join`, deeplink in het fragment.
- Regels en rekenwijze: een naam is uniek binnen de les (409). Een eigen leerlingsleutel; maximaal 60 per les.
- Onzekerheid: de naam is vrije tekst en wordt niet gecontroleerd.
- Wie hoort wat, wanneer: de begeleider ziet de naam en de presentie.
- Rollen en toestemming: een account of een gezinsprofiel onder het account van een ouder.
- Uitzonderingen: zonder account 401; een verlopen les 403.
- Acceptatiecriterium: Gegeven een kind als gezinsprofiel, wanneer het de QR opent, dan doet het mee zonder de code te tikken en verschijnt het bij de begeleider.

**SCH-02 Live meekijken en een bordfoto in het schrift** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: SSE `stroke`, `wis` en `bord`; `liveBord.fotoDataURL()`.
- Regels en rekenwijze: een foto wordt een bladzijde (<3e6 tekens).
- Onzekerheid: SSE is niet in de proef gemeten.
- Wie hoort wat, wanneer: niemand; de foto blijft in het eigen schrift.
- Rollen en toestemming: leerling.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een bord met tekening, wanneer de leerling op "Bewaar dit bord" tikt, dan staat er een bladzijde "Bordfoto hh:mm" in zijn schrift, ook na een herstart.

**SCH-03 Het schrift: tekst-, teken- en fotobladzijden** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/schrift/opslaan` en `GET /schrift/:code`.
- Regels en rekenwijze: maximaal 60 bladzijden. Het schrift wordt in zijn geheel vervangen (laatste versie geldt).
- Onzekerheid: bij twee apparaten tegelijk wint het laatste; er is geen versie-conflictmelding (in de code niet gezien).
- Wie hoort wat, wanneer: de begeleider kan meelezen.
- Rollen en toestemming: de eigen leerlingsleutel. Een klasgenoot krijgt 403 (proef).
- Uitzonderingen: een 61e bladzijde wordt afgekapt; het scherm moet dat zeggen. Dat is een eis; ik heb niet nagelopen of het scherm dat al doet.
- Acceptatiecriterium: Gegeven twee bladzijden, wanneer de leerling dubbel op Bewaar tikt, dan heeft het schrift er twee en geen vier.

**SCH-04 Opgave maken en inleveren** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/opgave/inleveren`.
- Regels en rekenwijze: één inzending per opgave per leerling; de laatste telt.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de begeleider direct (SSE `inzending`).
- Rollen en toestemming: alleen de leerling zelf. Ingetrokken is geweigerd.
- Uitzonderingen: een onbekende opgave geeft 404.
- Acceptatiecriterium: Gegeven een opgave, wanneer de leerling twee keer inlevert, dan ziet de begeleider één inzending met het laatste antwoord.

**SCH-05 Agenda van de les** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `lesPubliek().agenda` en SSE.
- Regels en rekenwijze: alleen lezen.
- Onzekerheid: de datum is vrije tekst.
- Wie hoort wat, wanneer: n.v.t.
- Rollen en toestemming: leerling.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een nieuw agendapunt, dan ziet de leerling het zonder te herladen.

**SCH-06 AI-bijleshulp die niet voorzegt, met buddy en leeftijdslaag** · L4 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `/ai`, `SYSTEM` en `leeftijdInstr`.
- Regels en rekenwijze: maximaal 10 berichten, ongeveer 110 woorden per antwoord, hint in plaats van antwoord. Zonder model of bij een fout een vast demo-antwoord.
- Onzekerheid: de leeftijdslaag komt uit `data-rtf-groep` van de client en niet uit een gecontroleerd gegeven.
- Wie hoort wat, wanneer: het gesprek wordt niet opgeslagen in `schrift.js` (in de code niet gezien). Of de modelaanbieder het bewaart, hangt af van `server/ai.js` en de configuratie; niet vastgesteld.
- Rollen en toestemming: een geldige les-, leraar- of leerlingsleutel.
- Uitzonderingen: met `RTG_EXTERNE_AI_UIT=1` alleen lokaal of de demo.
- Acceptatiecriterium: Gegeven "wat is 3/4 + 1/8?", wanneer de leerling het vraagt, dan bevat het antwoord een stap of hint en niet alleen "7/8". Zonder model komt een van de drie vaste antwoorden met `demo: true`.

**SCH-07 Tip van de dag** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/tip`, een rotatie op het dagnummer.
- Regels en rekenwijze: dezelfde tip de hele dag.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: n.v.t.
- Rollen en toestemming: geen sleutel nodig (de route heeft geen `lesVan`).
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven twee verzoeken op dezelfde dag, dan is `tip` gelijk.

**SCH-08 Schrift meenemen, compleet (ook tekeningen en foto's)** · L5 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `RTGUitvoer` geeft nu alleen tekst.
- Regels en rekenwijze: een bestand met alle bladzijden, met tekeningen gerenderd als afbeelding.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de leerling.
- Rollen en toestemming: leerling.
- Uitzonderingen: een bordfoto met materiaal van derden is alleen voor eigen gebruik; het bestand zegt dat.
- Acceptatiecriterium: Gegeven een schrift met tekst, tekening en foto, wanneer de leerling meeneemt, dan bevat het bestand alle drie als leesbare bladzijde.

**SCH-09 Hulp vragen aan de begeleider ("ik zit vast")** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: een vlag per leerling in de les, via SSE alleen naar de docent.
- Regels en rekenwijze: aan of uit door de leerling zelf; de begeleider zet hem op "gezien".
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen de begeleider; klasgenoten niet.
- Rollen en toestemming: de leerling zelf.
- Uitzonderingen: zonder begeleider online staat er "je begeleider is er nu niet; je vraag blijft staan".
- Acceptatiecriterium: Gegeven een leerling die op "Ik zit vast" tikt, dan ziet de begeleider binnen de les zijn naam onder "vraagt hulp" en zien andere leerlingen niets.

**SCH-10 Terugkoppeling van de begeleider lezen** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: BRD-07.
- Regels en rekenwijze: tekst bij de eigen inzending. Geen cijfer.
- Onzekerheid: n.v.t.
- Wie hoort wat, wanneer: alleen de leerling.
- Rollen en toestemming: leerling.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven terugkoppeling op opgave 1, dan staat die onder het eigen antwoord en nergens bij een klasgenoot.

**SCH-11 Meekijken door de ouder (kind onder de 16) en eigen regie vanaf 16** · L3 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: de band in `rtf.wie-mag-zien`; het schrift van een gezinsprofiel-deelnemer.
- Regels en rekenwijze: alleen-lezen, alleen het eigen kind, alleen als het kind meedeed als gezinsprofiel.
- Onzekerheid: wanneer het kind zelf beslist, is een besluit (UAVG 16).
- Wie hoort wat, wanneer: het kind ziet dat de ouder meekijkt.
- Rollen en toestemming: geen tweede rechtenmodel.
- Uitzonderingen: de beschermingsdeur gaat voor.
- Acceptatiecriterium: Gegeven een kind van 11 als gezinsprofiel, wanneer de ouder het schrift opent, dan ziet hij het alleen-lezen en ziet het kind "je ouder heeft meegekeken".

**SCH-12 Bijleshulp met de context van de opgave (Child Context Firewall)** · L4 · half · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: alleen de tekst van de huidige opgave en het vak, geen naam en geen schrift.
- Regels en rekenwijze: minimale context per taak (SCHOOL.md par. 11.4), met een AI-bonnetje erbij (par. 11.5).
- Onzekerheid: de klasse **advies**: uitleg, geen beoordeling.
- Wie hoort wat, wanneer: de begeleider ziet niets van het gesprek.
- Rollen en toestemming: leerling.
- Uitzonderingen: zonder model de demo.
- Acceptatiecriterium: Gegeven een vraag bij opgave 2, wanneer de leerling hem stelt, dan stuurt de server de opgavetekst en het vak mee, maar niet de naam van de leerling (te controleren in de request-log van de toets), en toont het antwoord een bonnetje.

**SCH-13 Toegankelijk schrijven en lezen: voorlezen, dicteren, groter, typen in plaats van tekenen** · L1 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: browserfuncties (spraak) op het toestel. Geen externe dienst.
- Regels en rekenwijze: geen opname naar de server; alleen de tekst die de leerling bewaart.
- Onzekerheid: spraakherkenning verschilt per toestel.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: leerling.
- Uitzonderingen: zonder ondersteuning blijft het knopje weg en staat er waarom.
- Acceptatiecriterium: Gegeven een opgave, wanneer de leerling op "voorlezen" tikt, dan wordt de opgave voorgelezen op het toestel en gaat er geen audio naar de server.

**SCH-14 Mijn schrift blijft van mij, over lessen heen** · L5 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen nu
- Gegevens en bron: bij sluiten (BRD-15) een kopie die de leerling zelf bevestigt, naar een eigen bewaarplek op de codenaam (account of gezinsprofiel). Dat is een verwijzing naar de les, geen gedeelde data.
- Regels en rekenwijze: de vier voorwaarden van het leerdossier. Geen niveau, geen vergelijking.
- Onzekerheid: bij een anonieme deelnemer (alleen een vrije naam) bestaat geen codenaam, dus geen overname.
- Wie hoort wat, wanneer: alleen de leerling, plus meekijken onder SCH-11.
- Rollen en toestemming: de leerling bevestigt de overname.
- Uitzonderingen: zonder bevestiging vervalt het schrift met de les.
- Acceptatiecriterium: Gegeven een gesloten les, wanneer het kind "bewaar mijn schrift" bevestigt, dan opent het een week later zijn schrift zonder lescode, en ziet de begeleider het niet meer.

**SCH-15 Offline schrijven en later bewaren** · L5 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: een concept op het toestel (in de huisregels: `localStorage` alleen als gemak).
- Regels en rekenwijze: bewaren pas als er verbinding is, met de herhaalsleutel.
- Onzekerheid: een concept kan verloren gaan; het scherm zegt dat.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: leerling.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven geen netwerk, wanneer de leerling schrijft en de verbinding terugkomt, dan staat zijn tekst er één keer.

**SCH-16 "Dit snap ik" of "geoefend" vanuit het schrift naar het eigen leerdossier** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: Connect `/api/rtf/connect/noteer` (zelf) of een systeemregel "geoefend" na inleveren, alleen met een codenaam.
- Regels en rekenwijze: de schrijfgrendel van `leerdossier.js`. De begeleider schrijft nooit.
- Onzekerheid: "begrepen" heeft de graad `vermoed`.
- Wie hoort wat, wanneer: alleen de leerling.
- Rollen en toestemming: de leerling bevestigt.
- Uitzonderingen: een anonieme deelnemer krijgt niets.
- Acceptatiecriterium: Gegeven een kindprofiel dat heeft ingeleverd, wanneer het "zet in mijn dossier" kiest, dan staat er "geoefend" bij het vak in het eigen Connect-dossier, en kan de begeleider dat niet lezen.

**SCH-17 Huiswerk uit de lesagenda naar School (verwijzing)** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: `rtf.school`.
- Regels en rekenwijze: klaarzetten; de leerling bevestigt.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het eigen School-overzicht.
- Rollen en toestemming: School beslist.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een agendapunt "maak opgave 5 voor vrijdag", wanneer de leerling "zet in mijn huiswerk" bevestigt, dan staat het in `apps/foundation/school.html` met een link naar de les.

**SCH-18 De beschermingsdeur in het schrift en in de bijleshulp** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/shared/uitstap.js` en de bestaande schermen `rtf.hulpwijzer`, `hulp.pesten` en `rtf.onveilig` (HDI.md par. 7, regels 1–2: staat).
- Regels en rekenwijze: een vaste uitweg op het scherm en een regel in de bijleshulp: bij signalen van onveiligheid niet doorvragen, maar verwijzen naar de deur. Geen detectie of signaal naar wie dan ook (geen automatische maatregel; SCHOOL.md par. 14).
- Onzekerheid: de AI kan een signaal missen. De deur staat er daarom altijd, en niet alleen na detectie.
- Wie hoort wat, wanneer: niemand. Er gaat geen melding naar de begeleider of ouder.
- Rollen en toestemming: geen.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een open schrift, dan is er op elk tabblad één tik naar de hulpwijzer. Gegeven de vraag "thuis is het niet veilig" aan de bijleshulp, dan noemt het antwoord de hulpdeur en slaat de server niets op.

**SCH-19 Typetempo, kijktijd of focusmeting** · — · aanbevolen niet doen
- Reden: dat is aandachtsmeting en surveillance (SCHOOL.md par. 11.6).

**SCH-20 AI die het huiswerk maakt of het antwoord geeft** · — · aanbevolen niet doen
- Reden: het `SYSTEM`-besluit: "help met begrijpen, niet met spieken".

**SCH-21 Badges, sterren of streaks voor schrijven** · — · aanbevolen niet doen
- Reden: progressie alleen voor 18+ (`progressieMag`), en leren is geen wedstrijd.

**SCH-22 Reisaanvraag in het lesmodule** · — · aanbevolen niet doen (verhuizen, geen nieuwe functie)
- Reden: `/reis/aanvraag` staat in `onderwijs/schrift.js`, terwijl `reizen.aanvraag` de eigenaar is (`apps/foundation/reis.html`). Twijfel: aan de integrator voorleggen of de route daarheen moet.

### e. RTG-exclusief

1. **Een schrift dat met het kind meegroeit zonder rapportcijfer.** Schrift (SCH-14) → codenaam van het gezinsprofiel (`gezin.beheer`) → Connect-dossier (SCH-16) → portfolio (CON-14) → cv later (`werk.cvmaker`). Elke schakel bezit alleen zijn eigen gegevens en verwijst naar de vorige.
2. **Bijleshulp met dezelfde buddy als thuis.** `foundation/buddy.js` levert de buddy en de leeftijdslaag aan de gezinscoach en aan de les-AI. Het kind praat in de les met dezelfde vertrouwde figuur, zonder dat de les iets van het gezinsgesprek ziet.
3. **De beschermingsdeur midden in het leren.** Schrift (SCH-18) → hulpwijzer of onveilig (eigenaar: RTF, `rtf.hulpwijzer` en `rtf.onveilig`) → beschermzaak (`server/kern/beschermzaak/`, HDI-keten). Geen schoolschrift op de markt heeft die deur in het schrift zelf.

### f. Bouwstenen en ontbrekende koppelingen

**Wat er staat:** `server/foundation/onderwijs/schrift.js`, `les.js`, `lesaccount.js`, `toegang.js`, `server/foundation/basis.js` (SYSTEM, DEMO, TIPS), `server/foundation/buddy.js`, `public/apps/foundation/{schrift.html,tekenen.js,realtime.js,sessie.js}`, `/shared/uitvoer.js`, `scripts/lib/voltooi/rtfschrift.js`, `test/taalschrift.test.js`, `test/onderwijs.test.js`.

**Wat ontbreekt:**

| van → naar | vorm | wat |
|---|---|---|
| Schrift → Bord | binnen de les | SCH-09, SCH-10 |
| Schrift → eigen bewaarplek op codenaam | verwijzing | SCH-14 |
| Schrift → Connect | verwijzing en eigen bevestiging | SCH-16 |
| Schrift → School | verwijzing | SCH-17 |
| Schrift → `uitstap.js` / hulpwijzer | UI-verwijzing | SCH-18 |
| Schrift → `rtf.wie-mag-zien` | relatie | SCH-11 |
| `/reis/aanvraag` → `reizen.aanvraag` | verhuizen | SCH-22 |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| SCH-01 t/m 07 | onderhouden | klein | laag | APPWERKT bereikbaar en bedienbaar meten, IDOR meten |
| SCH-18 beschermingsdeur | nu | klein | laag | geen |
| SCH-09 hulp vragen | nu | klein | laag | BRD-13 |
| SCH-10 terugkoppeling | nu | klein | laag | BRD-07 |
| SCH-08 compleet meenemen | nu | klein | laag | `RTGUitvoer` |
| SCH-12 bijleshulp met context en bonnetje | nu | klein | midden | AI-bonnetje (SCHOOL.md par. 11.5) |
| SCH-13 toegankelijk | nu | middel | midden | `TOEGANKELIJK.md` |
| SCH-14 schrift blijft van mij | nu | middel | hoog | BRD-15, besluit over de bewaarplek |
| SCH-11 ouder kijkt mee | later | middel | hoog | `rtf.wie-mag-zien`, UAVG |
| SCH-15 offline | later | middel | midden | geen |
| SCH-16 naar leerdossier | later | klein | midden | SCH-14, CON-22 |
| SCH-17 naar School | later | klein | midden | `rtf.school` |
| SCH-22 reisroute verhuizen | opruimen | klein | laag | integrator |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket is **"veilig, gehoord en het blijft van mij"**: SCH-08, SCH-09, SCH-10, SCH-12, SCH-13, SCH-14 en SCH-18, samen met BRD-07 en BRD-15. Er komt geen nieuwe laag bij. De beschermingsdeur hergebruikt `uitstap.js` en de bestaande hulpschermen. Het bonnetje volgt SCHOOL.md par. 11.5.

Wat de leerling daarna kan dat hij nu niet kan:
- hulp vragen aan de begeleider zonder dat de klas het ziet;
- terugkoppeling lezen;
- zich laten voorlezen of dicteren;
- zijn hele schrift meenemen, ook de tekeningen;
- zijn schrift na de les houden;
- vanaf elk tabblad direct bij hulp komen als het thuis niet goed gaat.

### Uitkomst B — het domeinmaximum

Schrift als **levenslang leerschrift van elke Nederlander**: van groep 3 tot volwassenenonderwijs, eigendom van de leerling, en met toestemming te openen voor wie hem begeleidt.

Nieuwe professionele processen:

1. **Remedial teacher of dyslexiebegeleider** (rol: specialist; genre: **nieuw, eigenaarsbesluit**; dyslexiezorg valt mogelijk onder de Jeugdwet, niet nagezocht). Het proces: de leerling geeft een begeleider toegang tot een deel van zijn schrift, de begeleider zet oefeningen klaar en koppelt terug, de ouder of leerling stopt de toegang. Nodig: het besluit en een toegang per map, geen tweede rechtenmodel maar de band uit `rtf.wie-mag-zien`.
2. **Mentor in het voortgezet onderwijs** (rol: mentor in School). Het proces: de leerling deelt bij een mentorgesprek een momentopname (portfolio plus schrift), en het gesprek wordt vastgelegd in School. Nodig: de koppeling met School Core (extern: verwerkersovereenkomst), en een **besluit** dat schrift-momentopnames naar School mogen.
3. **Volwassenenonderwijs en inburgering** (rol: docent bij een taalaanbieder). Het proces: een schrift met vertaalhulp (SCHOOL.md par. 8) en bewijs van oefenen voor het eigen dossier. Nodig: een **besluit** over hergebruik van de vertaallaag, en `leren.volwassenenonderwijs` als ingang.
4. **Zorg en onderwijs** (bijvoorbeeld een ziek kind thuis; wetsvoorstel ondersteuning zieke leerlingen, zie Bord c). Het proces: de school stuurt werk, het kind werkt thuis in zijn schrift, en de consulent ziet alleen wat het kind deelt. Nodig: **eigenaarsbesluit**, en de Child Context Firewall tussen zorg- en leerdata (SCHOOL.md par. 11.4).
5. **Lokale AI op het toestel** (`TOESTEL.md`) voor de bijleshulp. Nodig: een **besluit**, omdat dit een nieuwe motor raakt.

Ook in B: geen score, geen ranglijst en geen niveau-label onder 18; de beschermingsdeur blijft altijd open; bevestigen doet de leerling.

### Ketens LOS en SAMEN

**LOS.** Zonder Bord-activiteit, gezinslaag en model blijft de kerntaak: meedoen met een lescode (account), het eigen schrift schrijven en teruglezen, het bord van de laatste stand bekijken en inleveren. Het scherm zegt dan:
- bij opgaven "Nog geen opgaven. De begeleider zet ze hier klaar.";
- bij de bijleshulp een van de drie vaste antwoorden (dat dit een vast antwoord is, moet het scherm zeggen; `demo: true` staat in het antwoord, maar ik heb niet nagelopen of het scherm het toont);
- zonder account bij meedoen: "Log in met je RTG-account; een gratis account is genoeg."

**SAMEN, de keten "kind maakt de opgave, vraagt hulp en bewaart":**
1. Het kind doet mee als gezinsprofiel via de QR (Leren & Groei `rtf.leren-groei` → Schrift `leren.livesles`).
2. Het ziet de opgave (Bord `rtf.bord` → SSE).
3. Het vraagt de buddy om een hint (Schrift `/ai`; model via `server/ai.js`).
4. Het levert in (Schrift).
5. De begeleider leest en koppelt terug (Bord, BRD-07).
6. Het kind bewaart een bordfoto en neemt na de les het schrift mee (Schrift, SCH-08 en SCH-14).
7. (Later) Het kind zet "geoefend" in zijn dossier (Connect).

**Storingen:**
- **Het model is uit (stap 3):** het vaste demo-antwoord; de les gaat door.
- **SSE valt uit (stap 2):** de opgave komt pas na herladen (`GET /les/:code`).
- **De leerling is ingetrokken (stap 4):** 403 "Doe eerst mee met de les."
- **Dubbele tik op Inleveren:** één inzending (proef).
- **Crash na bewaren:** de bladzijden blijven (proef).
- **Les verlopen voordat het kind bewaart (stap 6):** zonder SCH-14 is het schrift onbereikbaar. Dat gat moet Uitkomst A dichten.
- **De gezinssessie op een gedeeld toestel:** gaat niet mee naar een volgend account (af89167b; een serverregel volgt).

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | meting |
|---|---|---|
| breedte | tekst, tekening, foto, voorlezen, dicteren en compleet meenemen | voltooistappen SCH-08 en SCH-13 |
| professionele diepte | terugkoppeling en hulpvraag lopen tussen precies één leerling en de begeleider | BEVOEGD-kruispaar "klasgenoot ziet terugkoppeling niet" |
| levenscyclus | meedoen, schrijven, inleveren, les sluiten, schrift behouden (met bevestiging) en wissen | `scripts/lib/voltooi/rtfschrift.js`, uitgebreid |
| samenwerking en rollen | de ouder leest alleen-lezen bij een kind onder de 16, en het kind ziet dat | voltooistap SCH-11 |
| domeinintelligentie | de bijleshulp krijgt alleen opgave en vak, draagt een bonnetje en geeft nooit alleen het antwoord | toets op de request-inhoud en het antwoordschema |
| los functioneren | zonder model en zonder SSE: schrijven, inleveren en teruglezen werken | voltooiproef (staat al voor het model) |
| RTG-ketens | schrift → dossier (eigen bevestiging) en schrift → hulpwijzer met één tik | e2e-keten |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN; IDOR gemeten met 0 doorbraken | APPWERKT.json, IDOR.json |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | geen dubbele logica: Schrift alleen… |
|---|---|---|
| oefenen, examens en leerlijn | `apps/rtgschool.html`, `leren.school` (schil `apps/foundation/leerpaspoort.html`) | verwijst; geen tweede oefenmotor. `server/school/bijles.js` is een tweede bijlesgesprek (`kern/bijles.js`, "een motor, twee werelden"); de les-AI gebruikt die motor niet. Twijfel: aan de integrator voorleggen of `/ai` op `kern/bijles.js` moet |
| huiswerk, rooster en toetsen | `apps/foundation/school.html`, `rtf.school`; `apps/foundation/toetsen.html`, `leren.toetsplanner` | zet klaar (SCH-17) |
| schrijfopdrachten met een buddy | `apps/foundation/schrijven.html`, `leren.schrijven` | verwijst; geen tweede dagopdracht |
| overhoren (woordjes, tafels) | `apps/foundation/overhoren.html`, `rtf.overhoren` | verwijst |
| samen een werkstuk | `apps/foundation/projecten.html`, `leren.project` | verwijst |
| wie mag meekijken | `apps/foundation/mijnbanden.html`, `rtf.wie-mag-zien` | leest de band (SCH-11) |
| hulp bij nood, pesten, onveilig | `apps/foundation/hulpwijzer.html`, `rtf.hulpwijzer`; `apps/foundation/pesten.html`, `hulp.pesten`; `apps/foundation/onveilig.html`, `rtf.onveilig`; anoniem `apps/foundation/wegwijzer.html`, `hulp.wegwijzer` | verwijst (SCH-18) |
| een tiener die wil praten over wat speelt | het scherm met doel "Als tiener praten met een AI-buddy … hulplijnen vinden bij nood" staat in SCHERMEIGENAAR.json, maar ik heb het pad niet uitgelezen. Twijfel: aan de integrator voorleggen | verwijst; de bijleshulp wordt geen tweede steungesprek |
| reisaanvraag of voordracht | `apps/foundation/reis.html`, `reizen.aanvraag` | hoort de route `/reis/aanvraag` niet te dragen (SCH-22) |
| gratis leerapps | `apps/foundation/schoolbieb.html`, `rtf.schoolbieb` | verwijst |
| privacyuitleg voor het gezin | `apps/foundation/privacy.html`, `rtf.privacy-uitleg` | verwijst |


---

## 10. Vrienden — `link:vrienden`, `/apps/foundation/vrienden.html`

Vrienden is de contactenlaag van een gezin in FoundationOS (capability `rtf.contacten`, eigenaar volgens SCHERMEIGENAAR.json). Gezinsleden vinden elkaar en RTG-leden op codenaam, of koppelen via een contactpin of een QR-code van 45 seconden. Daarna sturen ze berichten, bellen ze, sturen ze snaps die één keer te bekijken zijn en delen ze verhalen die 24 uur blijven staan. Voor een beschermd profiel (rol `kind`, of leeftijdsgroep mini, kind of tiener, dus tot en met 15 jaar) is de laag gesloten. Het kind is onvindbaar en kan niet zelf verzoeken sturen. Alleen een ouder voegt contacten toe, en de ouder van het andere kind keurt goed. De kern is **toezicht op wie, niet op wat**: een ouder ziet en beheert de kring van zijn kind, maar leest geen inhoud.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | n.v.t. | de deur staat in FoundationOS (`app-main-24a2b.js`, map-rtf); hij is uit LivingOS weggehaald omdat een lid daar op een dicht scherm uitkwam |
| bedienbaar | BEWEZEN | n.v.t. | |
| menselijk | NIET_GETEST | 3 stappen menselijk-afgeleid | register gemeten vóór de proef |
| voltooibaar | GEEN_FIXTURE | sluit, 7 stappen | `scripts/lib/voltooi/vrienden.js`: de ouder voegt toe, de andere ouder keurt goed, de kinderen sturen elkaar berichten; daarbij ook bevoegdheid (anoniem, vreemde ouder, kind zelf) |
| waarheidsgetrouw | NIET_GETEST | niet in de proef | |
| persistent | GEEN_FIXTURE | sluit, 3 stappen | herstart, gelezen uit de opslag (op profielsleutel `rtf:`, geen e-mail), nieuwe kindersessie vanuit het ouderaccount |
| bevoegd | BEWEZEN | (stappen onder voltooibaar) | BEVOEGD.json: 10 van 12 kruisparen gescheiden; IDOR niet gemeten |
| herstelbaar | GEEN_FIXTURE | sluit, 5 stappen | dubbel goedkeuren, dubbel toevoegen, afgebroken bericht, crash (SIGKILL), dubbel versturen |

De proef zegt zelf wat er buiten valt (`grens` in `vrienden.js`): snaps, verhalen, de contactpin, bellen (WebRTC) en de live stroom lopen niet mee, en er draait geen Redis of PostgreSQL.

**Wat de code doet (gelezen):**
- **Poorten.** `server/routes/social/gezinnen.js` heeft `gezinsPoort` (een geldig gezinsprofiel, geen gast, via `rtfSociaal` → `rtf.verifieerProfiel`) en `nietBeschermd` (403 met "Je ouder of verzorger voegt vrienden voor je toe."). Gasten (oppas, familie) doen niet mee: "Als oppas of familielid doe je hier niet mee."
- **Wie beschermd is.** `isBeschermd` in `server/foundation/gezinshulp.js`: `rol === 'kind'` of groep `mini|kind|tiener`. De groep wordt bij elke aanroep opnieuw uit de geboortedatum berekend (`actualiseerGroep`). Volgens het commentaar is "de hele tienergroep (12 t/m 15)" bewust streng.
- **Vriendenlaag** (`server/routes/social/gezinnen/vrienden.js`, kern `server/kern/sociaal/vrienden/verbinden.js` en `contact.js`):
  - `find` (alleen voor wie niet beschermd is; beschermde profielen worden nooit gevonden), `connect` (een verzoek aan een beschermd kind geeft 404, "we verklappen niet dat het bestaat"), `respond`, `connections`, `connect/intrek` (een eigen openstaand verzoek terugtrekken; de ontvanger krijgt geen seintje);
  - `oudervoeg`: alleen de beheerder voegt een contact toe voor een beschermd kind van zijn eigen gezin, op codenaam of contactpin, met een rem (`pinClusterRem`, plus `sociaalRate` van 30 per uur). Is de andere kant ook een beschermd kind, dan moet diens ouder nog akkoord geven (`voogdWacht`);
  - `goedkeuren`: de ouder keurt een wachtend verzoek goed of af. Is het kind de ontvanger, dan telt het akkoord van de ouder ook als accepteren;
  - een verbinding is pas actief bij `status 'accepted'` en een lege `voogdWacht` (`verbActief` in `server/kern/sociaal.js`).
- **Berichten.** `dm` en `dm/send`: alleen tussen actieve vrienden, zonder blokkade, maximaal 60 per minuut, 500 tekens, met een herhaalsleutel `idem`. De opslag staat in de communicatiekern (`kern/comm`), niet in een eigen voorraad.
- **Snaps en verhalen** (`server/kern/sociaal/snaps.js`):
  - een snap gaat alleen naar een actieve vriend, maximaal 40 per 5 minuten, met een foto van hooguit circa 900 kB in de versleutelde mediastore;
  - een snap is één keer te bekijken: bij het openen worden bestand en snap gewist. Onbekeken verloopt hij na 24 uur;
  - een verhaal is 24 uur zichtbaar voor de maker en zijn actieve vrienden. Er staat één verhaal per persoon;
  - de dag-opdracht ("iets geels") kan een verhaal een label geven;
  - de snap-streak is bewust verwijderd ("een teller die alleen omhoog gaat als je elke dag komt, maakt van contact een verplichting").
- **Contactpin en levende QR** (`gezinnen/pin.js`): een vaste pin, vernieuwen, uitzetten en bevriezen, zoeken met rem, verbinden met een bon in RTG Link, en een levende code van 45 seconden. Elk loket staat dicht voor een beschermd profiel. De beheerder krijgt de pin van zijn kind mee in `connections`, zodat hij die aan een andere ouder kan geven.
- **RTG Link aan de gezinskant** (`gezinnen/link.js`): `link/los` en `link/koppelingen`, ook achter `nietBeschermd`.
- **Toezicht en veiligheid** (`gezinnen/toezicht.js`):
  - de live stroom opent met een eenmalig stroomticket;
  - bellen gaat via een signaal en alleen tussen actieve vrienden, met ICE achter `gezinsPoort`;
  - `block` en `unblock` werken in beide richtingen;
  - `report` zet een regel (`door`, `doel`, `reden` tot 300 tekens) in de lijst `reports`. Bewijs wordt niet bewaard;
  - `kind/contacten` laat de ouder de kring zien (met de labels `volwassene` en status), `kind/verwijder` haalt een contact weg;
  - via `kind/boardroom`, `zet`, `zetveel` en `herstel` zet de ouder functies van het kind aan of uit. Elke wijziging komt in het journaal van het kind met `door: 'ouder'`.
- **Productie.** `/api/rtf/social` staat in `BESCHERMDE_ROUTEFAMILIES` (`server/middleware/foundation-productiepoort.js`) en geeft in productie 503 zolang er geen extern vrijgavedossier is. Blokkeren, melden, een verzoek intrekken, `kind/verwijder`, afkeuren (`akkoord:false`) en een functie uitzetten (`aan:false`) gaan daar als veilige uitgang altijd door (`foundation-veilige-uitgangen.js`).

**Meting van de coördinator over snaps en verhalen (gebruikt in plaats van een eigen aanname):** er staat geen open deur voor kinderen. `beschermd.test.js`, `snaps-routes.test.js` en `rtf-veilig.test.js` slagen alle 17:
- een beschermd kind is onvindbaar, een verzoek van buiten geeft 404, en zelf zoeken of verzoeken geeft 403;
- alleen de beheerder voegt toe, met een tweede ouderakkoord als de andere kant ook een beschermd kind is;
- snaps gaan alleen naar actieve vrienden, verhalen zijn alleen voor de maker en actieve vrienden (anders 404);
- de ouder ziet de contacten, niet de inhoud.

Drie open ontwerpvragen staan in d (VRI-08, VRI-12, VRI-14).

**Eigen bevinding (gelezen, niet gemeten):** de schakelaars die een ouder in de kinder-boardroom omzet (zoals `dm`, `verzoeken` en `streak` = Dag-opdracht in `server/kern/lidboard/catalogus.js`) worden afgedwongen in de `auth`-middleware van leden (`server/opzet/diensten2.js`, `lidBoardUit(sess.key, lidPadFunctie(req.path))`). De gezinsroutes `/api/rtf/social/*` lopen niet door die middleware, en `PAD_FUNCTIE` noemt geen `/api/rtf/`-pad. In de gelezen code zag ik dus geen plek waar "Directe berichten uit" voor een kind ook `/api/rtf/social/dm/send` dichtzet. De enige andere lezer van `lidBoardUit` is `kern/spellen/presence.js`. Dit moet gemeten worden (zie VRI-15).

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Messenger Kids (Meta) | één app, ouderdashboard via Facebook | geen gegevens | instelling voor contacten ("My child can choose friends" met melding aan de ouder, of "Only I can choose friends"), meerdere ouders op één kind; volgens een derde partij ook chatgeschiedenis en foto's van de laatste 30 dagen zichtbaar voor de ouder, een slaapstand, en een melding aan de ouder als het kind iemand blokkeert of meldt | Messenger Kids — https://messengerkids.com/sr/getting-started/what-is-messenger-kids/ (opdrachtbrief); Bark-gids — https://www.bark.us/tech-guide/app-management-messenger-kids/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| JusTalk Kids | gratis met in-app-aankopen; maand, half jaar, jaar, plus Premium-niveaus | VS: $9.99 per maand, $19.99 per 6 maanden, $39 per jaar; Frankrijk: €39.99 per jaar | ouder keurt elk vriendverzoek goed met een melding, groeps- en één-op-één-chat, videobellen, push-to-talk; volgens een review ook end-to-end-versleuteling en automatische markering van gevoelige beelden met een melding aan de ouder | JusTalk Kids — https://kids.justalk.com/ (opdrachtbrief); App Store — https://apps.apple.com/us/app/-/id1403744827 (zoekresultaat 2026-10-19, pagina niet geopend) |
| Bark (monitoring, geen chatapp) | Bark Jr; Bark Premium (duurste abonnement); Bark Phone | Premium $14 per maand of $99 per jaar; Jr $5 per maand of $49 per jaar; Bark Phone $29–$89 per maand (bedragen verschillen per pagina) | monitoring van sociale media, e-mail en YouTube (Premium) | Bark Products & Pricing — https://www.bark.us/?p=44396 ; TechRadar — https://techradar.com/reviews/bark (zoekresultaat 2026-10-19, pagina niet geopend) |

**Welke kernfuncties wij hebben:**
- ouder keurt contacten goed: **ja** (`oudervoeg`, `goedkeuren`, `voogdWacht` aan beide kanten; strenger dan Messenger Kids, want ook de andere ouder keurt);
- ouder ziet en wist de contactenlijst: **ja** (`kind/contacten`, `kind/verwijder`);
- een kind kiest zelf vrienden onder toezicht (de Messenger Kids-stand): **nee**, en bewust zo voor wie 15 of jonger is;
- melding aan de ouder als het kind blokkeert of meldt: **nee** (VRI-07);
- slaapstand of rusttijd: **nee** (zie RTF-12, hoort bij het gezin en niet bij deze app);
- ouder leest de chatgeschiedenis: **nee**, en bewust niet (toezicht op wie, niet op wat);
- end-to-end-versleuteling: **nee** (foto's staan wel versleuteld in de mediastore);
- automatische beeldmarkering: **nee** (zie Niet doen);
- geen telefoonnummer nodig: **ja** (codenaam, pin, levende QR);
- videobellen: **ja** (WebRTC, eigen STUN/TURN);
- groepsgesprek: **nee** (VRI-11).

### c. Het volledige domein

**Hoe het echt gaat.**
- *Particulier.* Kinderen krijgen hun eerste contactlijst rond de basisschoolleeftijd, meestal klasgenoten, sportvrienden en familie. Ouders wisselen gegevens uit op het schoolplein of de verjaardag. Tieners willen steeds meer eigen regie, en wat ze mogen hangt af van de leeftijd en van het gezin. Het grootste risico zit niet in de vriendjes die de ouder kent, maar in volwassenen en onbekenden, in beeldmateriaal dat doorgestuurd wordt, en in pesten binnen een bekende groep.
- *Professioneel.* Leerkrachten, mentoren, jeugdtrainers en jeugdhulpverleners komen met kinderen in contact. Wie in onderwijs, kinderopvang, jeugdhulp en gezondheidszorg werkt, valt onder de Meldcode huiselijk geweld en kindermishandeling: vijf stappen, met overleg met Veilig Thuis en een melding bij acute of structurele onveiligheid. De stappen worden vastgelegd in een dossier. Bron: NJi — https://www.nji.nl/kennis/kindermishandeling/hoe-werk-ik-met-meldcode-huiselijk-geweld-kindermishandeling (zoekresultaat 2026-10-19, pagina niet geopend).
- *Organisatorisch.* Scholen en clubs hebben hun eigen groepskanalen. De moderatie van meldingen ligt bij de dienstverlener.

**Regels en keurmerken.**
- **AVG en UAVG, toestemming onder 16.** Volgens de AVG is 16 de grens voor diensten van de informatiemaatschappij. Daaronder geeft of machtigt de ouder de toestemming, en moet de verwerkingsverantwoordelijke redelijke inspanningen doen om die te verifiëren. Nederland houdt 16 aan (UAVG). Preventieve of adviserende diensten die direct aan kinderen worden aangeboden, vragen volgens de richtlijn van de Commissie geen ouderlijke toestemming. Bronnen: Europese Commissie — https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_nl ; privacy-web — https://privacy-web.nl/en/artikelen/minderjarigen-social-media-en-sharenting-artikel-1-3/ (zoekresultaat 2026-10-19, pagina niet geopend). De zoekresultaten bevatten geen pagina van de Autoriteit Persoonsgegevens zelf.
- **Code voor Kinderrechten** (in opdracht van BZK, opgesteld door Universiteit Leiden en Waag). Tien beginselen, onder meer: het belang van het kind voorop, privacy by design, geen profilering, geen economische uitbuiting en geen schadelijk ontwerp. Het is een vrijwillige norm die rust op bindend recht. Bronnen: Universiteit Leiden — https://www.universiteitleiden.nl/nieuws/2021/03/code-voor-kinderrechten-ontwerpen-in-het-belang-van-het-kind ; Code (pdf) — https://codevoorkinderrechten.waag.org/wp-content/uploads/2021/10/Code-voor-kinderrechten-NL.pdf (zoekresultaat 2026-10-19, pagina niet geopend).
- **DSA, bescherming van minderjarigen.** De Commissie heeft richtsnoeren bij artikel 28 DSA vastgesteld (volgens LexisNexis op 14 juli 2025). Het is een niet-bindend kader over leeftijdsverificatie, safety by design, aanbevelingssystemen, commerciële inhoud en AI. Bronnen: LexisNexis — https://www.lexisnexis.com/en-gb/legal/news/the-european-commission-finalises-guidelines-on-the-protection-of-minors-what-they-mean-for-platforms ; kabinetsfiche — https://www.staten-generaal.nl/eu/behandeling/20251114/brief_regering_fiche_dsa/document3/f=/vmslh14umfme.pdf (zoekresultaat 2026-10-19, pagina niet geopend). Of Vrienden onder de DSA een "onlineplatform" is (er is geen openbare verspreiding; verhalen gaan alleen naar vrienden), heb ik niet vastgesteld. Dat is een vraag voor juridische toetsing.
- **Mediaopvoeding.** Netwerk Mediawijsheid vernieuwde de MediaDiamant in maart 2026, afgestemd op de landelijke Richtlijn Gezond Schermgebruik (leeftijd, invoering van smartphone en sociale media, de ouder als voorbeeld). Ouders wordt aangeraden vroeg afspraken te maken. Bronnen: Netwerk Mediawijsheid — https://netwerkmediawijsheid.nl/wp-content/uploads/2026/03/Persbericht-lancering-vernieuwde-MediaDiamant.pdf ; NJi — https://www.nji.nl/actueel/informatie-over-gezond-schermgebruik-voor-de-week-van-de-mediawijsheid (zoekresultaat 2026-10-19, pagina niet geopend).

**Wat daaruit volgt voor de app.**
1. De grens van 16 in de AVG en de grens van `isBeschermd` (tot en met 15) vallen samen. Dat is verdedigbaar en moet zo blijven.
2. Verifiëren van de ouder gaat bij ons verder dan "redelijke inspanning": een kind bestaat alleen onder een ouderaccount met een gecontroleerd paspoort (`gezinseigenaar.js`, `accountplicht.js`). De geboortedatum van het kind is wel door de ouder opgegeven en niet gecontroleerd (`leeftijdBron`, AGENTS.md).
3. De Code voor Kinderrechten vraagt geen schadelijk ontwerp en geen uitbuiting. Daarom is de streak eruit gehaald, en daarom komt er geen ranglijst of "beste vriend"-teller.
4. Het meldkanaal moet echt ergens uitkomen. Een melding zonder lezer is niet waarheidsgetrouw (VRI-06, VRI-09).
5. Een melder van 12 moet een volwassene kunnen inschakelen zonder zelf iets te hoeven uitleggen (VRI-07).

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** sterk. Contacten, berichten, bellen, snaps, verhalen en pin/QR bestaan, en de kern is bewezen in de voltooiproef. Melden zonder bewijs en een kind dat bij melden niemand inschakelt zijn de gaten.
- **L2 Professioneel (bestaande genres):** zwak. Er is geen lezer van meldingen bij RTG, en contacten met beroepskrachten zoals een leerkracht of trainer hebben geen eigen, gekeurde vorm.
- **L3 Organisatorisch:** afwezig. Geen klas- of clubkring en geen groepsgesprek.
- **L4 Domeinintelligentie:** een begin. Het label `volwassene` bij de ouder en de herkomst `via` (pin of code) bij een verzoek zijn signalen zonder inhoud. Er is nog geen samenvatting voor de ouder.
- **L5 Volledige levenscyclus:** half. Toevoegen, goedkeuren, verwijderen en blokkeren bestaan. De overgang op 16 jaar gebeurt stil, en of het wissen van een gezin de sociale sporen meeneemt, is niet vastgesteld.
- **L6 RTG-samenhang:** half. RTG Link is gekoppeld, en de communicatiekern bewaart de berichten. Pesten, Onveilig en Mediawijs worden niet vanuit Vrienden geopend.

**VRI-01 Contacten en verzoeken** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `connections` (de sociale opslag via `kern/sociaal/opslag`), met de codenaam uit `rtf.profielInfoVanHandle` of de ledengids.
- Regels en rekenwijze: zoeken pas vanaf 2 tekens en maximaal 10 treffers; beschermde profielen worden nooit gevonden; maximaal 30 verzoeken per uur; een blokkade weigert.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de ontvanger krijgt een SSE-signaal `request`. Wie een verzoek intrekt, stuurt geen signaal.
- Rollen en toestemming: een gezinslid dat niet beschermd is, beslist zelf. Een gast doet niet mee.
- Uitzonderingen: in de Postgres-stand wacht de bestaanscontrole op de gids (`codeBestaat`).
- Acceptatiecriterium: Gegeven een gezinslid van 17 en een RTG-lid, wanneer het gezinslid op codenaam zoekt en een verzoek stuurt, dan ziet het lid het verzoek, en na accepteren staan ze bij beiden als contact.

**VRI-02 Berichten met herhaalsleutel** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: de communicatiekern (`kern/comm`, `dm`). Een gedeelde Salon-post wordt bij het lezen opgelost voor deze lezer (`dmpost`).
- Regels en rekenwijze: alleen tussen actieve vrienden; maximaal 60 per minuut, 500 tekens, `<>` worden weggehaald; dezelfde `idem` levert hetzelfde bericht op.
- Onzekerheid: is de communicatiekern weg, dan staat er eerlijk een fout in plaats van een tweede voorraad.
- Wie hoort wat, wanneer: de ontvanger krijgt een SSE-signaal `dm`.
- Rollen en toestemming: alleen de twee deelnemers. De ouder leest niet mee.
- Uitzonderingen: een blokkade geeft 403 met "niet beschikbaar".
- Acceptatiecriterium: Gegeven twee verbonden kinderen, wanneer kind A een bericht stuurt en de verbinding wegvalt, dan staat het bericht na een nieuwe poging met dezelfde sleutel precies één keer bij kind B (bewezen in de voltooiproef).

**VRI-03 Bellen en videobellen** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (meten)
- Gegevens en bron: de signalen `ring|accept|offer|answer|ice|hangup|decline|busy` via SSE, en ICE uit `kern/rtc/ijs`.
- Regels en rekenwijze: alleen tussen actieve vrienden, niet na een blokkade. De server geeft alleen signalen door; de media gaan via WebRTC.
- Onzekerheid: zonder TURN-server faalt bellen achter een strenge NAT.
- Wie hoort wat, wanneer: de gebelde partij live.
- Rollen en toestemming: zoals bij berichten.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven twee verbonden profielen, wanneer A belt en B opneemt, dan komt er een verbinding tot stand, en na een blokkade krijgt A een 403. Dit hoort in een voltooiscenario; nu valt het buiten de proef.

**VRI-04 Snaps, verhalen en dag-opdracht** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (in de proef opnemen)
- Gegevens en bron: de lijsten `snaps` en `stories` met een verwijzing naar de mediastore (versleuteld).
- Regels en rekenwijze: een snap is één keer te bekijken en verloopt na 24 uur; een verhaal blijft 24 uur, één per persoon; foto als jpeg, png of webp tot circa 900 kB; maximaal 40 snaps per 5 minuten. Een snap heeft een optionele herhaalsleutel, maar de gezinsroute geeft die nog niet mee (commentaar in `snaps.js`).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de ontvanger krijgt een SSE-signaal `snap`; verhalen zien alleen de maker en actieve vrienden.
- Rollen en toestemming: voor kinderen alleen binnen de door ouders goedgekeurde kring (meting van de coördinator).
- Uitzonderingen: de gezinsroute `snap/send` geeft `idem` niet door. Een herhaalde tik kan daar dus een tweede snap opleveren.
- Acceptatiecriterium: Gegeven een snap die met een sleutel is verstuurd, wanneer de verzender na een crash opnieuw tikt, dan krijgt de ontvanger één snap. De gezinsroute geeft daarvoor `idem` door.

**VRI-05 Contactpin en levende QR** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (onderhoud)
- Gegevens en bron: `pinKaart`, `pinVernieuw`, `pinUit`, `liveMaak` en verwante functies (`kern/sociaal/pin-live.js`).
- Regels en rekenwijze: een levende code is 45 seconden geldig en draagt de vaste pin niet. Zoeken heeft een rem per persoon en per cluster. Een verzoek draagt `via: 'pin'|'code'`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de ontvanger ziet de herkomst "via je pin" bij het verzoek.
- Rollen en toestemming: elk loket staat dicht voor een beschermd profiel; de ouder krijgt de pin van zijn kind.
- Uitzonderingen: bevriezen trekt ook de levende code in.
- Acceptatiecriterium: Gegeven een kind van 10, wanneer het `/api/rtf/social/pin` opvraagt, dan krijgt het 403 met de vaste zin over de ouder, en de ouder ziet de pin van het kind in de kring.

**VRI-06 Blokkeren en melden** · L1 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `blokkeer` en `deblokkeer` (in beide richtingen); `meldMisbruik` schrijft naar `reports` (maximaal 5000, bewaartermijn volgens `bewaarbeleid-operationeel.js`).
- Regels en rekenwijze: een melding bewaart `door`, `doel`, `codenaamDoel` en `reden`, en geen inhoud.
- Onzekerheid: een lezer van deze lijst `reports` in het kantoor heb ik niet gevonden. Een grep op `reports` onder `server/routes/office` leverde niets op, en de andere treffers (`connection-communication*.js`) gaan over een andere lijst. Dit is dus niet waarheidsgetrouw zolang het scherm "Melden bij de beheerder" zegt (`vrienden.html`, regel 473).
- Wie hoort wat, wanneer: nu niemand.
- Rollen en toestemming: elk gezinslid en elk lid kan melden.
- Uitzonderingen: blokkeren en melden gaan in productie altijd door, als veilige uitgang.
- Acceptatiecriterium: Gegeven een melding door een kind, wanneer die is opgeslagen, dan staat hij binnen één werkdag in een bak die een RTG-medewerker leest (VRI-09), en de tekst op het scherm zegt precies wie hem leest.

**VRI-07 "Blokkeer en vertel het je ouder"** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de bestaande blokkeer- en meldactie, plus een seintje aan de beheerder van het gezin (SSE of gezinsmelding).
- Regels en rekenwijze: het seintje bevat alleen *dat* het kind iemand blokkeerde of meldde, met de codenaam van de ander. Geen berichttekst en geen foto.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de beheerder direct; het kind ziet op het scherm "je ouder weet het".
- Rollen en toestemming: alleen voor beschermde profielen. Voor een tiener van 16 of ouder is het een keuze van de tiener zelf (de regel van `rtf.wie-mag-zien`).
- Uitzonderingen: is de ouder zelf de geblokkeerde of gemelde partij, dan gaat er geen seintje naar die ouder, maar wordt de beschermingsdeur getoond (`rtf.onveilig`). Zo blijft de beschermingsdeur open (HDI.md par. 7).
- Acceptatiecriterium: Gegeven een kind van 11 dat een contact blokkeert, wanneer het blokkeren slaagt, dan krijgt de beheerder van dat gezin een melding met de codenaam en zonder inhoud. Is het geblokkeerde contact de beheerder zelf, dan gaat er geen melding naar de beheerder en ziet het kind de link naar Onveilig.

**VRI-08 Bewijs bij een melding van een snap** · L1/L2 · ontbreekt · kosten middel · complexiteit hoog · later (eigenaarsbesluit; ontwerpvraag 1 van de coördinator)
- Gegevens en bron: een snap wordt na één keer kijken gewist (`snapOpenen`), en `meldMisbruik` bewaart alleen een reden. Een kind kan dus geen bewijs meegeven.
- Regels en rekenwijze, voorstel: een knop "melden" in de snapkijker *vóór* het sluiten. Die bevriest de snap in de mediastore met een vaste korte termijn en zet hem alleen open voor een RTG-moderator met een verplichte reden en een regel in het inzagejournaal, zoals het kantoor nu een documentnummer opent. Na afhandeling wordt hij gewist.
- Onzekerheid: beeldmateriaal van minderjarigen bewaren kan zelf strafbaar of AVG-gevoelig zijn. Hoe RTG zo'n beeld afhandelt (doorzetten naar politie of een meldpunt, niet zelf beoordelen) is een juridisch besluit. Een wetsartikel heb ik daarvoor niet gevonden.
- Wie hoort wat, wanneer: de moderator; de ouder van het melder-kind via VRI-07, zonder het beeld.
- Rollen en toestemming: de melder geeft het bewijs bewust door; de ander krijgt geen seintje.
- Uitzonderingen: niets wordt automatisch doorgestuurd. Alles wat een instantie bereikt, is één menselijke bevestiging (besluit 7).
- Acceptatiecriterium: Gegeven een kind dat een snap opent, wanneer het in de kijker op "melden" tikt, dan is de snap voor de verzender en het kind weg, ligt hij versleuteld klaar voor één moderator met journaal, en wordt hij na de vastgestelde termijn aantoonbaar gewist.

**VRI-09 Meldingenbak voor RTG-moderatie** · L2 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: de lijst `reports`, en daarnaast als verwijzing (id) de communicatiekern-meldingen (`connection-communication-actions.js`).
- Regels en rekenwijze: per melding een stand (`nieuw`, `in behandeling`, `afgehandeld`) en een besluit met reden. De moderator ziet codenamen, geen echte namen (het kluisbeleid). De Meldcode is een route voor professionals in hun eigen sector. RTG is daar geen meldplichtige instantie en doet niet alsof; de bak wijst wel naar Veilig Thuis.
- Onzekerheid: wie de moderator is (een kantoorrol), staat nergens vast in wat ik las.
- Wie hoort wat, wanneer: de melder krijgt een stand terug ("we hebben je melding gelezen"), zonder de uitkomst over de ander.
- Rollen en toestemming: een kantoorrol met een eigen poort; geen gezinsrol.
- Uitzonderingen: een melding over een direct gevaar toont de melder meteen 112 en Veilig Thuis via `rtf.onveilig`. De moderatiebak is niet de beschermingsdeur.
- Acceptatiecriterium: Gegeven een melding van een gezinslid, wanneer een moderator haar afhandelt, dan staat er een besluit met reden en tijd, en ziet de melder in Vrienden dat ze gelezen is.

**VRI-10 Beroepskracht als gekeurd contact** · L2 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: de bestaande genres en persoonseisen (`kern/aanmeldingen/bewijs.js`, `kern/persoonseis.js`, `kern/vakbewijs.js`; reikwijdte `werk` voor kinderopvang en beveiliging).
- Regels en rekenwijze: een contact dat via een zaak met zo'n genre binnenkomt (bijvoorbeeld een gekeurde kinderopvang), krijgt in de kring van het kind het label "beroepskracht van <zaak>", en geldt alleen zolang de persoonseis geldt. Die wordt bij elke vraag opnieuw gerekend. Scholen en sportclubs hebben in wat ik las geen eigen genre; die vallen hier dus buiten (besluit 6).
- Onzekerheid: RTG valideert niets inhoudelijk; het label zegt alleen dat een RTG-medewerker het stuk zag.
- Wie hoort wat, wanneer: de ouder ziet het label bij `oudervoeg` en in de kring.
- Rollen en toestemming: de ouder voegt toe zoals nu; de beroepskracht kan zelf geen kind benaderen.
- Uitzonderingen: verloopt het vakbewijs, dan vervalt het label en ziet de ouder dat.
- Acceptatiecriterium: Gegeven een medewerker van een gekeurde kinderopvang wiens persoonseis is verlopen, wanneer de ouder de kring van zijn kind opent, dan staat het contact er zonder het label beroepskracht, met de zin "keuring verlopen".

**VRI-11 Klas- of clubkring (groepsgesprek)** · L3 · ontbreekt · kosten groot · complexiteit hoog · later
- Gegevens en bron: een groep zou een verwijzing zijn naar een bestaande klas (`rtf.school`, `rtf.klas`) of een gezinsgroep, zonder eigen ledenlijst in Vrienden.
- Regels en rekenwijze: een groep bestaat alleen uit leden die elkaar al als actieve vriend hebben of die een beheerder van de bron (leerkracht of gezin) heeft toegelaten. Voor een beschermd kind blijft het ouderakkoord per persoon gelden.
- Onzekerheid: groepen zijn de plek waar pesten gebeurt, dus melden per bericht is nodig.
- Wie hoort wat, wanneer: de groepsleden.
- Rollen en toestemming: de bron (de klas) is eigenaar van het lidmaatschap; Vrienden toont alleen.
- Uitzonderingen: een groep met een volwassene van buiten de bron is niet toegestaan zonder ouderakkoord.
- Acceptatiecriterium: Gegeven een klas van 24 leerlingen, wanneer de leerkracht een groepsgesprek opent, dan zien alleen leerlingen met een ouderakkoord de groep, en staat er per bericht een meldknop.

**VRI-12 Volwassene buiten het gezin in de kring van een kind** · L4 · half · kosten klein · complexiteit laag · aanbevolen nu (deel 1); eigenaarsbesluit (deel 2) (ontwerpvraag 2 van de coördinator)
- Gegevens en bron: `teKeuren` en `kindContacten` geven al `volwassene: !isKindHandle(ander)`. De code van `oudervoeg` maakt geen onderscheid: een ouder kan een volwassene van buiten het gezin toevoegen, en daarna kunnen die twee snappen en berichten sturen (meting van de coördinator).
- Regels en rekenwijze, deel 1 (nu): bij `oudervoeg` naar een volwassene buiten het eigen gezin vraagt het scherm een tweede, uitdrukkelijke bevestiging ("Dit is een volwassene buiten je gezin"). In de kring krijgt dat contact een vast label.
- Regels en rekenwijze, deel 2 (besluit): mogen snaps die na één keer kijken verdwijnen, wel bestaan tussen een beschermd kind en een volwassene buiten het gezin? Optie A (aanbevolen): snaps en verhalen staan voor zo'n paar uit; berichten en bellen blijven, en die zijn wel meldbaar met bewijs. Dat kost weinig: één controle in `snapSturenNu` en `verhalenVoor`. Optie B: alleen het label, de ouder beslist. Dat kost niets, maar het risico ligt dan bij de ouder. Optie C: niets veranderen. Dat is in strijd met de geest van de Code voor Kinderrechten.
- Onzekerheid: `isKindHandle` kijkt naar de rol `kind`. Een RTG-lid van 16 of 17 telt daardoor als "volwassene". Dat moet het label eerlijk zeggen ("geen kind van een gezin" in plaats van "volwassene"), of het moet de leeftijd lezen.
- Wie hoort wat, wanneer: de ouder bij het toevoegen; het kind ziet het label niet als waarschuwing, alleen als feit.
- Rollen en toestemming: alleen de beheerder.
- Uitzonderingen: familie (opa, oma) zit als gast in het gezin en hoort niet in Vrienden, maar in het gezinskanaal.
- Acceptatiecriterium: Gegeven een beheerder die een RTG-lid zonder kinderprofiel toevoegt voor zijn kind van 9, wanneer hij op toevoegen tikt, dan vraagt het scherm een tweede bevestiging met de reden. Na optie A geeft `snap/send` van dat lid naar het kind 403.

**VRI-13 Pinlek-signaal** · L4 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: het veld `via` bij een verzoek (`verbinden.js`).
- Regels en rekenwijze: komen er binnen een week twee of meer verzoeken "via je pin" van onbekenden, dan stelt het scherm voor de pin te vernieuwen. Dat is een signaal, geen besluit.
- Onzekerheid: een drempel is een keuze en geen feit. Het scherm zegt "dit kan betekenen dat je pin rondgaat".
- Wie hoort wat, wanneer: alleen de pinhouder (iemand van 16 of ouder; een beschermd kind heeft geen eigen pinloket), en bij een kind de ouder.
- Rollen en toestemming: alleen de eigenaar van de pin.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven drie verzoeken via de pin in een week, wanneer de pinhouder Vrienden opent, dan ziet hij één regel met de knop "pin vernieuwen", en na vernieuwen geeft de oude pin 404.

**VRI-14 Leeftijdsgrens voor snaps en de dag-opdracht** · L4 · ontbreekt · kosten klein · complexiteit laag · eigenaarsbesluit (ontwerpvraag 3 van de coördinator)
- Gegevens en bron: er is geen minimumleeftijd voor snaps zelf. De dag-opdracht kan een verhaal een label geven (`opdracht`).
- Regels en rekenwijze, opties: A (aanbevolen) snaps en verhalen pas vanaf groep `kind` (5 jaar), dus niet voor `mini`, en het label van de dag-opdracht niet zichtbaar op verhalen van beschermde profielen. B: alles laten zoals het is, met de kinder-boardroom als knop voor de ouder. Die werkt pas na VRI-15. C: snaps pas vanaf 12. Dat is strenger, en een kind van 8 verliest dan iets wat binnen een goedgekeurde kring weinig risico heeft.
- Onzekerheid: is het label van de dag-opdracht "progressie"? Het telt niets en bewaart geen stand, dus volgens `progressieMag` waarschijnlijk niet. Toch is het een dagelijkse prikkel. Twijfel: aan de integrator voorleggen.
- Wie hoort wat, wanneer: de ouder in de kinder-boardroom.
- Rollen en toestemming: de ouder.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een profiel in groep `mini`, wanneer het een snap probeert te sturen, dan geeft de server 403 met een zin voor de ouder (bij optie A).

**VRI-15 Kinder-boardroom afdwingen op de gezinsroutes** · L4/L6 · ontbreekt (gelezen, niet gemeten) · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `lidBoardUit(handle, fid)` (`kern/lidboard`), en de schakelaars `dm`, `verzoeken` en `streak`.
- Regels en rekenwijze: één poort na `gezinsPoort` (geen tweede rechtenmodel; dezelfde motor met de RTF-handle als sleutel) koppelt `/api/rtf/social/dm*` aan `dm`, `oudervoeg` en `respond` aan `verzoeken`, en het label van de dag-opdracht aan `streak`. Staat de functie uit, dan volgt 403 met `functieUit`.
- Onzekerheid: eerst meten of de handhaving echt ontbreekt. Ik heb het alleen gelezen.
- Wie hoort wat, wanneer: het kind ziet "deze functie heeft je ouder uitgezet" en het journaal toont `door: 'ouder'`.
- Rollen en toestemming: alleen de beheerder zet om. Een kind kan het journaal lezen.
- Uitzonderingen: blokkeren, melden en de beschermingsdeur zijn nooit uit te zetten (een veilige uitgang).
- Acceptatiecriterium: Gegeven een ouder die "Directe berichten" voor zijn kind uitzet, wanneer het kind een bericht stuurt via `/api/rtf/social/dm/send`, dan antwoordt de server 403 met `functieUit: 'dm'`, en melden blijft werken.

**VRI-16 Overgang naar 16 jaar** · L5 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `actualiseerGroep` zet een profiel op de verjaardag stil van `tiener` naar `jong`, en daarmee valt `beschermd` weg.
- Regels en rekenwijze: een week vooraf krijgen de tiener en de ouder elk een uitleg: wat verandert er (zelf zoeken, een eigen pin), wat blijft (de bestaande contacten), en dat de ouder de kring niet meer ziet. Op de dag zelf beslist de tiener over zijn eigen vindbaarheid (`gids` staat standaard aan; voorstel: bij de overgang de vraag stellen in plaats van stil aanzetten).
- Onzekerheid: de geboortedatum van een kind is door de ouder opgegeven (`leeftijdBron`) en niet gecontroleerd.
- Wie hoort wat, wanneer: de tiener en de beheerder, een week vooraf en op de dag.
- Rollen en toestemming: na 16 is de tiener baas over zijn kring.
- Uitzonderingen: verandert de ouder de geboortedatum vlak voor de overgang, dan staat dat in het journaal.
- Acceptatiecriterium: Gegeven een tiener die morgen 16 wordt, wanneer de dag aanbreekt, dan is `beschermd` false, staat zijn vindbaarheid op de keuze die hij vooraf maakte, en geeft `kind/contacten` van de ouder 403.

**VRI-17 Een vriendschap zelf beëindigen** · L5 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `socialIntrek` raakt alleen een openstaand verzoek ("een vriendschap beeindigen ... verdient zijn eigen weg"). `kind/verwijder` is voor de ouder. Een eigen route om een geaccepteerde vriendschap te beëindigen heb ik niet gezien; blokkeren is nu de enige weg.
- Regels en rekenwijze: "ontvrienden" zonder blokkade, in beide richtingen, zonder seintje aan de ander.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand; de ander ziet de vriend niet meer in zijn lijst.
- Rollen en toestemming: elk gezinslid voor zichzelf, ook een beschermd kind (een contact weghalen is altijd veilig).
- Uitzonderingen: in productie een veilige uitgang.
- Acceptatiecriterium: Gegeven twee verbonden kinderen, wanneer kind A het contact weghaalt, dan kunnen ze elkaar geen berichten of snaps meer sturen, en kan A het contact niet zelf opnieuw toevoegen (de ouder moet dat doen).

**VRI-18 Sociale sporen bij het wissen van een gezin** · L5 · niet vastgesteld · kosten klein · complexiteit midden · aanbevolen nu (meten)
- Gegevens en bron: `wisGezin` (`server/foundation/zorg.js`) wist de gezinsagenda, het gezin en de gezinscode. In die functie zag ik geen opruiming van `connections`, `snaps`, `stories` of de berichten in de communicatiekern op de handles van dat gezin.
- Regels en rekenwijze: bij het wissen gaan alle verbindingen, onbekeken snaps, verhalen en de mediabestanden van de handles van het gezin mee. Berichten bij de ander worden losgekoppeld van de codenaam.
- Onzekerheid: een andere laag (bijvoorbeeld `kern/kappen.js`) kan dit al doen. Dat heb ik niet vastgesteld.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: zoals bij wissen (tweede volwassene).
- Uitzonderingen: een melding in `reports` blijft volgens het bewaarbeleid.
- Acceptatiecriterium: Gegeven een gewist gezin, wanneer een read-only lezer de opslag doorzoekt op `rtf:<CODE>:`, dan vindt hij geen verbinding, snap, verhaal of mediabestand meer.

**VRI-19 Doorverwijzen naar Pesten, Onveilig en Mediawijs** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: alleen links (`hulp.pesten` `/apps/foundation/pesten.html`, `rtf.onveilig` `/apps/foundation/onveilig.html`, `rtf.mediawijs` `/apps/foundation/mediawijs.html`).
- Regels en rekenwijze: in het blokkeer- en meldvenster staan "Wat kun je doen bij pesten" en "Ben je niet veilig?". De eerste keer dat een kind een snap ontvangt, staat er een link naar een Mediawijs-situatie. Er gaan geen gegevens mee.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen het kind.
- Rollen en toestemming: geen.
- Uitzonderingen: Onveilig werkt ook zonder sessie.
- Acceptatiecriterium: Gegeven een kind dat het meldvenster opent, wanneer het venster verschijnt, dan staan de twee links erin en openen ze zonder dat er iets wordt verstuurd.

**VRI-20 Koppelingen via RTG Link** · L6 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `/api/rtf/link/los`, `/api/rtf/link/koppelingen`, en de bon via `linkBon`.
- Regels en rekenwijze: dicht voor beschermde profielen; voor een gezinslid is de lijst "van mij open" altijd leeg.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gebruiker zelf.
- Rollen en toestemming: een gezinslid dat niet beschermd is.
- Uitzonderingen: lukt de bon niet, dan wordt dat gelogd en volgt geen stilte.
- Acceptatiecriterium: Gegeven een gezinslid van 17 dat via een pin verbindt, wanneer het "mijn koppelingen" opent, dan staat de verbinding er met de vorm `vast`.

**VRI-21 Rusttijd voor contact** · L4 · ontbreekt · kosten klein · complexiteit midden · later (hoort bij RTF-12)
- Gegevens en bron: een rusttijd per kindprofiel, ingesteld in de gezinslaag (RTF-12).
- Regels en rekenwijze: tijdens de rusttijd worden berichten en snaps bewaard maar niet gemeld. Bellen geeft "in rust". Geen teller, geen meting.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de afzender ziet "rust tot 7:00".
- Rollen en toestemming: de ouder stelt in, en het kind ziet de instelling.
- Uitzonderingen: berichten van een beheerder van het eigen gezin en de beschermingsdeur gaan altijd door.
- Acceptatiecriterium: Gegeven een rusttijd van 21:00 tot 7:00, wanneer om 22:00 een snap binnenkomt, dan krijgt het kind geen melding, en staat de snap er om 7:00.

**VRI-22 Ouder leest berichten of snaps** · L4 · niet doen
- Reden: toezicht op wie, niet op wat. Dat staat in de eerdere domeinkaart en in `rtf.wie-mag-zien`, en meelezen ondermijnt het vertrouwen dat een kind nodig heeft om juist bij problemen naar zijn ouder te gaan.

**VRI-23 Streaks, "beste vrienden" of tellers** · L1 · niet doen
- Reden: dat is een verslavend patroon en progressie onder 18 (`progressieMag`). De streak is al met reden verwijderd.

**VRI-24 Automatische beeldherkenning op snaps** · L4 · niet doen (vóór V1)
- Reden: dat is een nieuwe motor die een (extern) model op beelden van kinderen zet. Dat botst met lokaal-eerst, met `RTG_EXTERNE_AI_UIT`, en met "geen nieuwe motoren" (besluit 3). VRI-08 met een menselijke moderator is de weg binnen de huisregels.

**VRI-25 Openbaar zoeken op naam of een openbaar profiel** · L1 · niet doen
- Reden: codenamen zijn de privacy by design van het huis, en een beschermd kind blijft onvindbaar.

### e. RTG-exclusief

1. **De dubbele ouderpoort.**
   - Een kind krijgt alleen een contact als twee ouders, die RTG allebei heeft gezien, het akkoord hebben gegeven.
   - Keten: ouder A (account met gekeurd paspoort, `gezinseigenaar.js` en `volwassen()`) → `oudervoeg` (Vrienden) → `voogdWacht` → ouder B, die eveneens gekeurd is (`goedkeuren`, Vrienden) → een actieve verbinding.
   - Eigenaars: identiteit (`identiteit.verificatie`, `/apps/verificatie.html`) keurt de ouders, Vrienden (`rtf.contacten`) bezit de verbinding.
   - Geen gedeelde data: Vrienden leest alleen de uitkomst van `volwassen()`, via de accountplicht in `profielVan`.
2. **Een contact met een beroepskracht dat vervalt met diens vakbewijs** (VRI-10).
   - Keten: de zaak met een genre (aanmeldingen, `bewijs.js`) → de persoonseis van de medewerker (`persoonseis.js` en `vakbewijs.js`, afgetekend door een mens van RTG) → het label in de kring (Vrienden, alleen een verwijzing).
   - Eigenaars: het kantoor tekent af, Vrienden toont.
3. **Van melding naar hulp zonder dat het kind iets hoeft uit te leggen** (VRI-07, VRI-09, VRI-19).
   - Keten: het kind blokkeert in Vrienden → de beheerder krijgt een seintje (gezinslaag, `gezin.beheer`) → de melding gaat naar de moderatiebak (kantoor) → de link naar Pesten (`hulp.pesten`) of Onveilig (`rtf.onveilig`).
   - Elke schakel heeft zijn eigen eigenaar, en er gaat alleen een id of codenaam van schakel naar schakel.
4. **Hetzelfde contact in twee werelden.** Een gezinslid en een RTG-lid zitten in dezelfde vriendenlaag. De berichten staan in de ene communicatiekern (`comm.berichten`), zodat de gesprekken tussen RTG en RTF hetzelfde gesprek zijn, zonder kopie.

### f. Bouwstenen en ontbrekende koppelingen

**Wat er staat:**
- `server/routes/social/gezinnen.js` en `gezinnen/{vrienden,pin,link,toezicht}.js`;
- `server/kern/sociaal.js`, `kern/sociaal/vrienden/{contact,verbinden}.js` en `kern/sociaal/snaps.js`;
- `kern/lidboard/*`, `public/apps/foundation/vrienden.html` en `scripts/lib/voltooi/vrienden.js`;
- `server/middleware/foundation-productiepoort.js` en `foundation-veilige-uitgangen.js`.

**Wat ontbreekt, per koppeling:**
- Vrienden → gezinslaag (`gezin.beheer`): een seintje bij blokkeren of melden (VRI-07). Een verwijzing (codenaam plus soort gebeurtenis).
- Vrienden → kantoor-moderatie: een bak met een lezer voor `reports` (VRI-09). Een verwijzing (id van de melding); de lijst blijft bij Vrienden.
- Kinder-boardroom (`kern/lidboard`) → gezinsroutes van Vrienden: handhaving (VRI-15). Projectie van een stand, geen nieuw rechtenmodel.
- Persoonseis (`kern/persoonseis.js`) → kring van het kind: een label (VRI-10). Een projectie, bij elke vraag opnieuw gerekend.
- Vrienden → Pesten, Onveilig en Mediawijs: links (VRI-19).
- Gezinswisser (`wisGezin`) → sociale opslag: opruimen (VRI-18). Een aanroep van de sociale laag, niet andersom.
- Voltooiproef: snaps, verhalen, pin, bellen en de stroom erbij (VRI-03, VRI-04).

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| VRI-15 boardroom afdwingen | nu | klein | midden | eerst meten |
| VRI-06 + VRI-09 melden met lezer | nu | middel | midden | kantoorrol (eigenaarsbesluit wie modereert) |
| VRI-07 blokkeer en vertel je ouder | nu | klein | laag | gezinsmelding (bestaat in de gezinslaag) |
| VRI-12 deel 1 tweede bevestiging bij een volwassene | nu | klein | laag | geen |
| VRI-12 deel 2 snaps tussen kind en volwassene buiten het gezin | nu na besluit | klein | laag | eigenaarsbesluit (A/B/C) |
| VRI-14 leeftijdsgrens voor snaps en dag-opdracht | nu na besluit | klein | laag | eigenaarsbesluit; VRI-15 voor optie B |
| VRI-16 overgang naar 16 | nu | klein | midden | geen |
| VRI-17 zelf ontvrienden | nu | klein | laag | veilige-uitgangenlijst |
| VRI-18 wissen meten en sluiten | nu | klein | midden | meting |
| VRI-19 doorverwijzen | nu | klein | laag | geen |
| VRI-04 / VRI-03 in de voltooiproef, `idem` op de gezinssnap | nu | klein | laag | geen |
| VRI-13 pinlek-signaal | nu | klein | laag | geen |
| VRI-08 bewijs bij een snapmelding | later | middel | hoog | juridisch besluit, VRI-09 |
| VRI-10 beroepskracht als contact | later | middel | hoog | bestaande genres; kantoor tekent af |
| VRI-21 rusttijd | later | klein | midden | RTF-12 |
| VRI-11 klas- of clubkring | later | groot | hoog | School/Klas als eigenaar; communicatiekern-groepen |
| end-to-end-versleuteling | later | groot | hoog | eigen besluit; botst met VRI-08 |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket **"veilig contact dat zich laat bewijzen"**: VRI-15, VRI-07, VRI-06/VRI-09, VRI-12 (deel 1, en deel 2 na besluit), VRI-14 (na besluit), VRI-16, VRI-17, VRI-18, VRI-19 en VRI-13, plus de uitbreiding van de voltooiproef (VRI-03, VRI-04).

Wat de gebruiker daarna kan dat hij nu niet kan:
- een **ouder** die in de boardroom "berichten uit" zet, ziet dat het ook echt dicht gaat;
- de ouder krijgt een seintje als zijn kind iemand blokkeert of meldt, zonder iets te lezen;
- bij het toevoegen van een volwassene van buiten het gezin krijgt de ouder een expliciete vraag;
- de ouder krijgt een week voor de zestiende verjaardag uitleg over wat er verandert;
- een **kind** kan een vriendschap zelf beëindigen zonder te blokkeren;
- het kind komt vanuit het meldvenster met één tik bij Pesten of Onveilig;
- het kind weet dat zijn melding gelezen wordt, en door wie;
- **RTG** heeft een moderatiebak met een besluit en een reden per melding;
- na het wissen van een gezin blijft er aantoonbaar niets sociaals achter.

Er komt geen nieuwe motor bij: de boardroom, de communicatiekern, de gezinsmelding en het kantoor bestaan al.

### Uitkomst B — het domeinmaximum

Het eindproduct: een kindveilig communicatiemiddel dat ouders, scholen en jeugdprofessionals vertrouwen, omdat elk contact een gekeurde herkomst heeft en elke melding een menselijke afhandeling.

**Nieuwe professionele processen (elk onderdeel met [besluit] vraagt een eigenaarsbesluit):**

1. **Moderatie van meldingen als dienst** [besluit: rol en bezetting]
   - Wie: een RTG-moderator (kantoorrol). Hij valt niet onder de bestaande genres, want het is RTG zelf.
   - Proces: melding → triage (direct gevaar ja of nee; bij ja meteen 112 en Veilig Thuis voor de melder, en de moderator belt niet zelf) → onderzoek op codenaam met journaal → besluit (waarschuwing, blokkade van de account, of doorzetten naar politie of meldpunt na één menselijke bevestiging) → terugkoppeling van de stand aan de melder.
   - Per stap nodig: werkinstructie, bewaartermijn (`bewaarbeleid`), en een juridisch protocol voor beeldmateriaal van minderjarigen [besluit + extern advies].
2. **Bewijs veiligstellen** (VRI-08) [besluit + extern: juridisch]
   - Wie: de melder (kind of ouder) en de moderator.
   - Proces: bevriezen in de kijker → versleuteld bewaren met een korte termijn → inzage met reden → doorzetten of wissen.
3. **Kring van beroepskrachten rond een kind**
   - Wie: een medewerker van een zaak met een bestaand genre (kinderopvang, met reikwijdte `werk`).
   - Proces: de zaak meldt de medewerker aan → RTG tekent het vakbewijs af → de ouder voegt hem toe → het label verloopt met het bewijs.
   - Nodig: alleen bestaande genres (besluit 6). School en sportclub als genre zou een nieuw genre zijn [besluit, en vóór V1 niet doen].
4. **Klas- en clubkanalen** (VRI-11)
   - Wie: de leerkracht via School/Klas (eigenaar `leren.school` / `rtf.klas`).
   - Proces: de klas bestaat in School → Vrienden toont het groepsgesprek als verwijzing → ouderakkoord per kind → moderatie via proces 1.
   - Nodig: groepsgesprekken in de communicatiekern [besluit: uitbreiding van een bestaande motor].
5. **End-to-end-versleuteling voor tieners van 16 of ouder** [besluit: dit botst met moderatie op inhoud]
   - Eventueel alleen voor de open laag, met melden zoals bij Signal (de melder stuurt zelf de inhoud mee).
6. **Samenwerking met een meldpunt** [extern: overeenkomst]
   - Wie: een extern meldpunt voor online misbruik.
   - Proces: de moderator zet een zaak door na één menselijke bevestiging.
   - Welk meldpunt en onder welke wet is in deze ronde niet onderzocht.

De huisregels blijven ook hier gelden: geen inhoud voor ouders, geen tellers, geen model op beelden van kinderen, en elke handeling naar een instantie is één menselijke bevestiging.

### Ketens LOS en SAMEN

**LOS.** Staan de andere apps uit, dan blijft de kerntaak: twee gezinnen verbinden hun kinderen via de ouders, en die kinderen sturen elkaar berichten (bewezen in de voltooiproef).
- Valt de communicatiekern weg, dan toont de vriendenlijst de vrienden zonder teller. Een bericht sturen geeft dan eerlijk de fout "De communicatiekern is niet beschikbaar." (`contact.js`).
- Valt de mediastore weg, dan zegt een snap "De foto kon niet worden opgeslagen."
- In productie zonder vrijgavedossier antwoordt de hele familie `/api/rtf/social` met 503 ("Deze functie is momenteel niet beschikbaar."). Blokkeren, melden, verwijderen en intrekken blijven werken.

**SAMEN — keten "Een vriendje van de voetbal":**

| stap | wie | app-eigenaar |
|---|---|---|
| 1. Ouder A logt in met zijn RTG-account | ouder A | Mijn gezin (`rtf.start`, `/apps/foundation/index.html`) |
| 2. RTG heeft het paspoort van ouder A gezien | kantoor | `identiteit.verificatie`, `/apps/verificatie.html` |
| 3. Ouder A opent de sessie van zijn kind op het toestel | ouder A | `rtf.start` (eigen-gezin/sessie) |
| 4. Ouder A typt de codenaam of pin over die ouder B hem gaf | ouder A | Vrienden (`rtf.contacten`, oudervoeg) |
| 5. Ouder B ziet het verzoek bij "te keuren" en keurt goed | ouder B | Vrienden (goedkeuren) |
| 6. De kinderen sturen elkaar berichten, bellen en snappen | kinderen | Vrienden; berichten bewaard in `comm.berichten` |
| 7. Ouder A kijkt in de kring van zijn kind | ouder A | Vrienden (kind/contacten) |
| 8. Een kind blokkeert later iemand en meldt het | kind | Vrienden, daarna moderatie (VRI-09, nog te bouwen) |

**Storingen in deze keten:**
- *Stap 2 valt uit* (paspoort niet gecontroleerd). Het kinderprofiel opent niet. Het scherm zegt "Kinderfuncties gaan open zodra RTG je paspoort heeft gecontroleerd." met de weg naar RTG iD (`eigen-gezin.js`). Wordt een keuring ingetrokken, dan valt ook een lopende kindersessie dicht (`profielVan` rekent bij elk verzoek).
- *Stap 5 komt niet* (ouder B reageert niet). Het verzoek blijft staan op "wacht-op-ouder". Een vervaltermijn is er niet in wat ik las. Ouder A kan het verzoek niet via `connect/intrek` terugtrekken, want die route gebruikt zijn eigen handle en niet die van het kind. `kind/verwijder` haalt in de code wel elke verbinding tussen de twee weg, ongeacht de status. Er is dus een weg, maar niet een die "intrekken" heet. Voorstel: een vervaltermijn en een knop "verzoek intrekken" voor de ouder, mee te nemen in VRI-17.
- *Stap 6, de communicatiekern valt uit.* Berichten sturen geeft een foutmelding, snaps en bellen werken door (snaps hebben een eigen opslag).
- *Stap 6, de live stroom valt uit.* De stroom probeert het na 3 seconden opnieuw en speelt gemiste gebeurtenissen af vanaf `last-event-id`.
- *Stap 8, moderatie ontbreekt.* Vandaag wordt de melding opgeslagen maar door niemand gelezen. Het scherm belooft "Melden bij de beheerder", en dat is niet waar (VRI-06).
- *Gedeeld toestel.* Logt ouder A uit en logt een ander in, dan wordt de gezinssessie in de browser gewist en op de server ingetrokken (`app-main-04.js`, `sluitGezinssessie`; toets `test/gezinssessie-gedeeld-toestel.e2e.js`).

### h. Eindcontract Beyond Premium

1. **Breedte.** Criterium: berichten, bellen, video, snaps, verhalen, pin/QR, blokkeren, melden met afhandeling, zelf ontvrienden en een groepsgesprek bestaan. Meting: per functie een route plus een voltooiscenariostap die slaagt.
2. **Professionele diepte.** Criterium: elke melding heeft een lezer, een besluit en een reden, en beroepskrachten staan alleen met een geldig vakbewijs gelabeld in een kring. Meting: een toets waarin een melding van open naar afgehandeld gaat met een journaalregel, en een toets waarin een verlopen persoonseis het label weghaalt.
3. **Levenscyclus.** Criterium: toevoegen, goedkeuren, ontvrienden, blokkeren, de overgang naar 16 en het wissen van een gezin werken allemaal en laten niets achter. Meting: een scenario over de verjaardag met een verzette klok, en een opslagzoektocht na het wissen (VRI-18).
4. **Samenwerking en rollen.** Criterium: kind, tiener, beheerder, gast, vreemde ouder en moderator hebben elk precies hun eigen rechten. Meting: de kruisparen in BEVOEGD gaan van 10/12 naar 12/12, en IDOR wordt gemeten in plaats van "niet gemeten".
5. **Domeinintelligentie.** Criterium: de signalen voor de ouder (volwassene in de kring, pinlek, blokkade door het kind) dragen nooit inhoud en zeggen bij elke drempel dat het een signaal is. Meting: een toets die de payload van elk signaal controleert op het ontbreken van tekst en foto's.
6. **Los functioneren.** Criterium: zonder communicatiekern, mediastore of stroom zegt het scherm per functie wat er niet werkt, en blijven melden en blokkeren werken. Meting: een toets met die afhankelijkheden uitgeschakeld.
7. **RTG-ketens.** Criterium: de keten "vriendje van de voetbal" loopt van inloggen met het account tot de kring met alle eigenaarsstappen, en melden komt bij Pesten, Onveilig en moderatie uit. Meting: een voltooiscenario over meerdere apps.
8. **Bewezen betrouwbaarheid.** Criterium: alle acht APPWERKT-bewijzen BEWEZEN, inclusief waarheidsgetrouw (de melding wordt gelezen) en menselijk, en snaps, pin, bellen en stroom zitten in de proef. Meting: APPWERKT.json na een nieuwe meting.

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

- **Rusttijd en schermtijd van een kind.** Hoort bij het gezin: `gezin.beheer` (`apps/foundation/beheer.html`). Vrienden leest alleen of er rust is (VRI-21) en heeft geen eigen klok.
- **Hulp bij pesten.** `hulp.pesten` (`apps/foundation/pesten.html`). Vrienden linkt alleen.
- **Onveiligheid en geweld.** `rtf.onveilig` (`apps/foundation/onveilig.html`). Vrienden linkt alleen, ook zonder sessie.
- **Leren over online veiligheid.** `rtf.mediawijs` (`apps/foundation/mediawijs.html`). Vrienden linkt naar een situatie en bouwt geen tweede uitleg.
- **Wie wat mag zien binnen het gezin (banden).** `rtf.wie-mag-zien` (`apps/foundation/mijnbanden.html`). Vrienden gaat over contacten buiten het gezin en kopieert de banden niet.
- **Chatten binnen het eigen gezin.** `rtf.contact` (`apps/foundation/contact.html`). Vrienden is voor buiten het gezin. Twijfel: aan de integrator voorleggen, want SCHERMEIGENAAR geeft voor `rtf.contacten` ook "chatten, bellen", dus de grens moet expliciet worden.
- **De berichten zelf.** `comm.berichten` (`apps/comm.html`; `apps/berichten.html` is een alias). Vrienden bewaart geen berichten.
- **Identiteit en paspoort van de ouder.** `identiteit.verificatie` (`apps/verificatie.html`) en `identiteit.rtgid-diensten` (`apps/rtgid.html`). Vrienden leest alleen de uitkomst.
- **Klas en school.** `leren.school` (`apps/rtgschool.html`), `rtf.school` (`apps/foundation/school.html`) en `rtf.klas` (`apps/foundation/klas.html`). Een klasgesprek is van de klas; Vrienden toont het hooguit.
- **Noodcontacten.** `veilig.noodcontacten` (`apps/veilig.html`) en voor het gezin `rtf.veilig-thuis` (`apps/foundation/veilig.html`).

---


---

## 11. Kwesties / Discussiekamer — `link:kwesties`, `/apps/foundation/kwesties.html`

Kwesties is de burgerkant van DemocratieOS: een lid brengt in wat er speelt, leest terug wat ermee gebeurde en waarom, kan samen met anderen een actie beginnen, en ziet bij een openbare kwestie de voorstellen van partijen naast elkaar, met bron en aannamelijst. De kern vandaag is de **burgerlus** "kwestie → behandeling → eindstand met reden → terugkoppeling → niemand kwijt" (`server/kern/democratie/index.js`, POLITIEK.md par. 18.1). De eigenaar noemt daarbovenop een **discussiekamer met echte mensen en gesimuleerde debatten, met broncontrole**. Dat deel bestaat in de code **niet**: er is geen argumentenkaart, geen reactie van lid op lid, geen debat en geen simulatie (grep op `debat`, `simul` en `gesimuleerd` in `server/kern/democratie/` en `public/apps/foundation/kwesties*` vond niets). POLITIEK.md noemt beleidssimulatie "jaren weg" (par. 18) en zet de democratische assistent in fase H, "pas nu, omdat zijn grenzen dan al bestaan". Voor wie: elke burger met minimaal een gratis account (een demosessie kan niet inbrengen), een jongere mag meedoen (POLITIEK par. 5), partijen via een account met de partijrol, en kantoormedewerkers op naam.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | scenario van een andere agent (`scripts/lib/voltooi/kwesties.js`); uitkomst niet in de brief | |
| bedienbaar | BEWEZEN | idem | |
| menselijk | BEWEZEN | idem | |
| voltooibaar | BEWEZEN | scenario: inbreng < 10 tekens geweigerd, inbreng op naam van A; B ziet niets, A opent uitkomst (gezien); A trekt in, tweede keer geweigerd | |
| waarheidsgetrouw | BEWEZEN | idem | |
| persistent | BEWEZEN | scenario: herstart byte voor byte gelijk, nieuwe sessie van A, opslag buiten de server gelezen | |
| bevoegd | BEWEZEN | BEVOEGD 1/1 kruisparen gescheiden | IDOR: 11 gescheiden (`actie/aansluit, afgelast, antwoord, plan, resultaat, start, stop, verlaat`, `kwestie/gezien, intrek, voorstellen`), 2 publiek (`actie/lijst`, bewust: openbare acties zonder namen; `kwestie/mijn`, geeft het eigen lijstje van wie vraagt), 1 onbereikbaar (`kwestie/inbreng`: de eigendomsvraag was niet aan de beurt). Kantoor- en partijroutes vallen niet onder deze ledenmeting |
| herstelbaar | BEWEZEN | scenario: dubbeltik één kwestie, afgebroken inbreng één kwestie, crash na inbreng en na intrekken | maar `INBRENG_IDEMPOTENT` staat in `bewijsstand.js` als **onbewezen** na een verloren antwoord over een herstart heen ("de bestaande duplicaatlagen staan in het geheugen") |

Wat de code doet (gelezen):

- **Ledenroutes** (`server/routes/democratie/index.js`): `kwestie/inbreng, mijn, gezien, intrek, voorstellen` en `actie/start, lijst, aansluit, verlaat, plan, afgelast, antwoord, resultaat, stop`. Alleen een sleutel `user-…` (eigen account, ook gratis). Een demosessie krijgt 403 met uitleg.
- **Kantoorroutes** (`kantoor.js`): `kwestie/lijst, behandel, eindstand, heropen, herbezorg`, `meter`, `partij/lijst, registreer, sleutel, uitschrijf, ontkoppel`. **Alles op naam** via `boardroomWie`. Met de gedeelde kantoorcode weigert de deur, ook bij lezen.
- **Partijdeur** (`partij.js`): `koppel` (eenmalige koppelcode in een kop, nooit in de URL), `wie, kwesties, voorstel/plaats, toelicht, aanname, mijn`. Rem per bron (120/min). Zes paden staan tijdelijk in `scripts/lib/publiek.js` voor de migratie, met einddatum 19 januari 2027 (`partijrol.js`).
- **De kwestie** (`kwestie.js`): één schrijver (`noteer`), tijdlijn en journaal als hashketen die nooit wordt ingekort; rondes; een eindstand verandert nooit achteraf; heropenen geeft een nieuwe ronde met een reden van minstens 15 tekens.
- **Gesloten eindstanden** (`eindstanden.js`): `uitgevoerd, samen-opgelost, afgewezen` (eist bevoegdheid), `samengevoegd` (eist doelkwestie), `doorgestuurd` (eist naar wie), `onhaalbaar, ingetrokken` (alleen inbrenger). Geen "anders".
- **Terugkoppeling in drie treden** (`klaargezet → gewekt → gezien`). De wek (`wek.js`) zegt niet welke kwestie, en een gedempte melding blijft `klaargezet`; `herbezorg` haalt in.
- **Pseudonimiteit** (`koppeling.js`): een kwestie draagt een inbrengersnummer `ib-…`, per kwestie nieuw. De sleutel staat op precies één plek. Vergeten haalt de sleutel weg en laat de regel staan (`vergeet`, aangeroepen via `kern.democratieVergeet` in `server/opzet/kernlaag7-ruimtes.js`).
- **Beeld** (`beeld.js`): het kantoor ziet tijden alleen tot op de dag en geen terugkoppeling of volgers.
- **Wie beslist** (`index.js`): alleen onder een codenaam. Wie inbracht of volgt, beslist niet (`eigenKwestie`, 409). Een door de inbrenger ingetrokken kwestie heropent het kantoor niet.
- **DoeNetwerk** (`doe.js`, `doe-bijeenkomst.js`, UI `public/apps/foundation/samendoen.js`): een actie alleen door wie de kwestie heeft, en alleen met `zichtbaar: true`; deelnemers op nummer, nooit namen; geen uitnodiging of herinnering; bijeenkomst met plaatsgrens, geen wachtlijst; maximaal 200 deelnemers.
- **Partijen en voorstellen** (`partijen.js`, `partijrol.js`, `voorstellen.js`, `connector.js`, UI `public/apps/foundation/voorstelbeeld.js`): register op naam met bron van officiële registratie, vijf niveaus, twee categorieën, geen veld voor ideologie of grootte; een voorstel vraagt titel, tekst en **bron** (≥ 5 tekens); aannamelijst met zeven vragen die op "onbekend" staat tot iemand een veld **met bron** invult; elk voorstel een eigen hashketen; dezelfde limieten voor elke partij (25 voorstellen per dag); volgorde op registernummer en elke dag één plaats verschoven; afwezigheid "Deze partij heeft hierover niets aangeleverd" in dezelfde vorm. Een partij ziet alleen kwesties die de inbrenger zelf openbaar maakte (via een actie), en dan alleen onderwerp en gebied.
- **Meter Niemand kwijt** (`meter.js`) met zeven soorten breuk en een aparte telling "vergeten". **Bewijsstand** (`bewijsstand.js`): bewezen NIEMAND_KWIJT, SQLITE_CRASH_CONSISTENCY, UNDECLARED_RTG_DEPENDENCY, NEUTRAAL_C1, MACHTSNEUTRAAL, ALLEEN_GLOBAAL, PSEUDONIEM_SPOOR, WEK_EERLIJK; onbewezen POSTGRES_DURABILITY, INBRENG_IDEMPOTENT, ZIJKANALEN.
- **Afhankelijkheden** (`afhankelijkheden.js`): elke module buiten de map is verklaard, met hoe vervangbaar.
- **Wat er niet is**: geen leeftijdsregel in deze map (grep op `volwassen`/`leeftijd` vond niets); POLITIEK par. 5 zegt dat stemmen in een formeel besluit langs `volwassen()` moet, maar er bestaat nog geen stemmen. Geen melden of moderatie van inbreng (grep op `moderat`/`misbruik` vond niets). Geen B1 en geen vertaling. Geen offline inbreng met herkomst `ter-plaatse`. Geen toezeggingsregister. Geen Rahul in dit domein.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Kialo Edu | gratis platform voor docenten; betaalde laag niet gevonden | gratis (volgens derde partijen) | discussie vanuit een centrale stelling met pro- en contraclaims, elke claim met eigen pro's en contra's; beoordelen, taken, 500+ open lesmaterialen, "Instant Access" zonder inlog | Kialo Edu features — https://www.kialo-edu.com/features (zoekresultaat 2026-10-19, pagina niet geopend); EdTech Impact — https://edtechimpact.com/products/kialo-edu/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Pol.is | geen gegevens | geen gegevens | geen gegevens uit de zoekdienst (zoekopdracht vond andere producten) | Pol.is — https://pro.pol.is/ (zoekresultaat eerder 2026-10-19, pagina niet geopend) |
| Community Notes (X) | onderdeel van X | geen prijs in zoekresultaat | "bridging": een notitie wordt pas getoond als beoordelaars die meestal van mening verschillen hem allebei nuttig vinden; volgens een analyse wordt ongeveer één op de tien voorgestelde notities gepubliceerd; kritiek: filtert gepolariseerde maar juiste inhoud | Community Notes guide — https://communitynotes.x.com/guide/en/contributing/notes-on-twitter (zoekresultaat eerder 2026-10-19, pagina niet geopend); NeurIPS — https://neurips.cc/virtual/2026/165248 (zoekresultaat 2026-10-19, pagina niet geopend); Oversight Board — https://www.oversightboard.com/wp-content/uploads/gravity_forms/78-bebea08df7d3661c35c6533a224228ef/2025/12/20251210_IDZ_Meta_ComNotes_Comment.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |
| Decidim | open source | geen prijs in zoekresultaat | ruimtes: participatieprocessen (in fasen), assemblies, initiatieven, conferenties; componenten: debatten, voorstellen, amendementen, stemmen, resultaten; reacties met voor/tegen/neutraal | Decidim features — https://decidim.org/features (zoekresultaat 2026-10-19, pagina niet geopend); Decidim docs — https://docs.decidim.org/features/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Go Vocal (voorheen CitizenLab) | Essential, Standard, Premium (duurste) | geen prijs op de pagina in het zoekresultaat; één Britse gemeente meldt een jaaruitgave van £20.580 | Premium: onbeperkt projecten, 8 beheerders, 25 projectmanagers, "advanced sensemaking", automatische vertaling in drie talen; Standard: rapportbouwer, automatische moderatie | Go Vocal plans — https://www.govocal.com/plans (zoekresultaat 2026-10-19, pagina niet geopend); Wigan — https://www.wigan.gov.uk/Docs/PDF/Council/Disclosure-Logs/2025/18107.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |
| Loomio | prijs per groep, enterprise op aanvraag | zoekresultaten tegenstrijdig (Capterra noemt o.a. Pro $149 per maand, andere listings andere bedragen) | besluitvorming in groepen; uitgenodigde leden betalen niet; 14 dagen proef | Loomio help — https://help.loomio.com/en/policy/subscriptions/pricing (zoekresultaat 2026-10-19, pagina niet geopend); Capterra — https://www.capterra.com/p/152670/Loomio/pricing/ (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| inbreng met terugkoppeling en reden | ja (sterker dan de leiders: gesloten eindstanden, meter Niemand kwijt) |
| argumentenstructuur pro/contra | nee |
| debatten tussen deelnemers | nee |
| voorstellen met bron en amendementen | half (partijvoorstellen met bron, toelichtingen en aannamelijst; geen burgervoorstellen, geen amendementen) |
| stemmen / budgetteren | nee (bewust: formeel stemmen loopt via `volwassen()`) |
| sensemaking / meningsclusters | nee |
| bridging-achtige broncontrole (Community Notes) | nee |
| moderatie (automatisch en menselijk) | nee |
| automatische vertaling | nee |
| fasen en processen | half (behandelrondes; geen processjabloon) |
| bijeenkomsten | ja (DoeNetwerk-bijeenkomst) |
| partijneutraliteit als toets | ja (uniek: DO-03, rotatie, gelijke limieten) |

### c. Het volledige domein

**Particulier.** Mensen willen iets kwijt (een kapotte lantaarn, een onveilige oversteek), willen begrijpen wat er speelt, en willen soms met anderen praten of iets samen doen. Ze haken af als ze geen antwoord krijgen.

**Professioneel.** Gemeenten organiseren inspraak en participatie. Een burgerberaad gebruikt loting: Amsterdam loot 2.000 bewoners, 240 reageerden, 100 werden geloot en kwamen met 26 maatregelen; Zuid-Holland loot 75.000 adressen uit het adresregister en daarna gewogen op geslacht, leeftijd, gemeente, opleiding en taal (Binnenlands Bestuur — https://www.binnenlandsbestuur.nl/bestuur-en-organisatie/mini-burgerberaad-amsterdam-komt-met-26-voorstellen-voor-klimaat (zoekresultaat 2026-10-19, pagina niet geopend); Zuid-Holland — https://www.zuid-holland.nl/publish/besluitenattachments/beantwoording-op-statenvragen-4005-fvd-burgerberaad-en-burgerakkoord/beantwoording-statenvragen-4005-van-de-fractie-fvd-burgerberaad-en-burgerakkoord.pdf (zoekresultaat 2026-10-19, pagina niet geopend)). Voorwaarden volgens TNO: politieke commitment, duidelijkheid over wat er met de uitkomst gebeurt, en een representatieve groep (Heemstede/TNO — https://gemeentebestuur.heemstede.nl/Vergaderingen/College-van-Burgemeester-en-Wethouders/2023/07-maart/09:30/Een-Heemsteeds-burgerberaad/TNO-rapport-burgerberaden-1.pdf (zoekresultaat 2026-10-19, pagina niet geopend)). Factcheckers werken volgens IFCN-principes: dezelfde maatstaf voor elke check, geen concentratie op één kant, geen beleidsstandpunten, bronnen zo vermeld dat lezers het werk kunnen herhalen, en open correcties (IFCN — https://ifcncodeofprinciples.poynter.org/the-commitments (zoekresultaat 2026-10-19, pagina niet geopend); FactCheck.kz — https://factcheck.kz/en/about-project (zoekresultaat 2026-10-19, pagina niet geopend)). Moderatoren werken met een meldprocedure en motiveringen.

**Organisatorisch.** Partijen, raadsfracties, wijkraden, bibliotheken (de WSOB noemt ontmoeting en debat als bibliotheekfunctie, zie Library c) en maatschappelijke organisaties.

Regels:
- **Wet versterking participatie op decentraal niveau** (Kamerstuk 36210; Eerste Kamer stemde in op 4 juni 2024): inspraakverordeningen worden participatieverordeningen, met een uitdaagrecht waarmee inwoners kunnen vragen een overheidstaak over te nemen, eventueel met budget. Wie "maatschappelijke partij" is, bepaalt de gemeente. Bron: Rijksoverheid — https://www.rijksoverheid.nl/actueel/nieuws/2024/06/04/eerste-kamer-stemt-in-met-wetsvoorstel-versterking-participatie-op-decentraal-niveau (zoekresultaat 2026-10-19, pagina niet geopend); kst 36210 2 — https://zoek.officielebekendmakingen.nl/kst-36210-2.pdf (zoekresultaat 2026-10-19, pagina niet geopend). Over de datum van inwerkingtreding: geen gegevens.
- **DSA**: een hostingdienst biedt een meldmechanisme (art. 16): elektronisch, met onderbouwing, locatie, naam en verklaring te goeder trouw, en een besluit met bezwaarmogelijkheid. Bron: Presencis — https://presencis.com/regulations/dsa/article-16/ (zoekresultaat 2026-10-19, pagina niet geopend); Lexgo — https://www.lexgo.be/en/news-and-articles/13295-notice-and-action-mechanisms-in-the-dsa-balancing-the-removal-of-illegal-content-and-the-freedom-of-expression (zoekresultaat 2026-10-19, pagina niet geopend). Vrije tekst van leden die anderen lezen (een discussiekamer) valt hieronder.
- **Verordening (EU) 2024/900 politieke reclame**: sinds 10 oktober 2025 van toepassing (art. 3 en 5(1) eerder); labels en transparantieverklaringen, voorwaarden voor targeting; uitvoeringsverordening 2025/1410 regelt het formaat. Bron: Matheson — https://www.matheson.com/insights/transparency-of-political-advertising-rules-now-in-force/ (zoekresultaat 2026-10-19, pagina niet geopend); Wikipedia — https://en.wikipedia.org/wiki/Transparency_and_Targeting_of_Political_Advertising_Regulation (zoekresultaat 2026-10-19, pagina niet geopend). POLITIEK par. 10 noemt dezelfde datum en vraagt een jurist.
- **AVG/UAVG**: een politieke opvatting is een bijzonder persoonsgegeven. Uit eigen kennis en niet uit een zoekresultaat; artikelnummer niet genoemd. Dat ondersteunt DO-05 en `NO_POLITICAL_PROFILE`.
- **IFCN** (zie boven): niet wettelijk, wel de vakstandaard voor broncontrole.

Wat daaruit volgt voor de app:
1. Een discussiekamer is **inhoud van leden voor leden**. Zonder meldmechanisme (DSA) mag hij niet open.
2. Broncontrole volgens IFCN betekent: **dezelfde maatstaf voor elke partij en elke burger**, bronnen herhaalbaar, correcties open. Dat past op DO-03, DO-08 en DO-10. Geen "waar/onwaar"-score per partij (DO-07).
3. Gesimuleerde debatten raken aan de verordening politieke reclame en aan DO-05/DO-06. Ze mogen nooit lijken op een uitspraak van een echte partij of persoon, nooit worden gericht, en moeten altijd herkenbaar zijn.
4. Participatie volgens de nieuwe wet is van de **gemeente**. RTG kan een kwestie doorsturen of een DoeNetwerk-actie een uitdaagrecht laten voorbereiden, maar dient niets in namens een burger (bevestigen doet de mens).
5. Sensemaking (meningsclusters) is alleen toegestaan als het over **uitspraken** gaat en nooit over personen, met een ondergrens van vijf (`server/kern/rtfos/gemeente.js` heeft die vorm, volgens POLITIEK par. 3).

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk**: sterk voor inbreng en terugkoppeling. Afwezig voor de discussiekamer zelf.
- **L2 Professioneel via bestaande genres**: half. Partijen via een account met de partijrol (geen genre). Kantoormedewerkers op naam. Voor factcheckers en gespreksleiders is er geen genre; `journalistiek` (caps `redactie`) ligt het dichtst bij.
- **L3 Organisatorisch**: half. Kwestiekantoor, partijregister en DoeNetwerk bestaan. Moderatie, gespreksleiding en gemeentekoppeling ontbreken.
- **L4 Domeinintelligentie**: minimaal. Meter en bewijsstand meten het systeem, niet het debat. Geen broncontrole, geen sensemaking, geen B1. Een voorspelling is nooit een feit.
- **L5 Volledige levenscyclus**: sterk voor de kwestie (rondes, heropenen, vergeten, niemand kwijt). Afwezig voor discussiebijdragen.
- **L6 RTG-samenhang**: dun. Alleen de wek via Berichten en vergeten zijn aangesloten. Geen gemeente, geen agenda, geen Library.

**KWE-01 Kwestie inbrengen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `democratieKwesties`, `democratieInbrengers` (`lid.js`, `koppeling.js`).
- Regels en rekenwijze: onderwerp ≥ 10 tekens (max. 600), gebied zelf gekozen (max. 80), nieuw inbrengersnummer per kwestie. Antwoord pas na duurzame vastlegging (503 als die mislukt).
- Onzekerheid: na een verloren antwoord over een herstart heen kan een tweede kwestie ontstaan (`INBRENG_IDEMPOTENT` onbewezen).
- Wie hoort wat, wanneer: alleen de inbrenger. Niemand anders ziet de kwestie tot hij er zelf een actie van maakt.
- Rollen en toestemming: eigen account (ook gratis). Geen demosessie.
- Uitzonderingen: geen adres opzoeken, geen politieke profilering bij binnenkomst.
- Acceptatiecriterium: Gegeven een lid met een gratis account, wanneer hij "De lantaarn op de hoek is al weken kapot" inbrengt, dan staat de kwestie op zijn naam in "Mijn kwesties", en een ander lid ziet haar niet.

**KWE-02 Mijn kwesties: stand, rondes en uitkomst lezen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `mijn` (`lid.js`) en `beeld.js` met de eigen refs.
- Regels en rekenwijze: de uitkomst staat er in dezelfde vastlegging als de eindstand. Openen zet de trede op `gezien`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: inbrenger en volgers, elk alleen hun eigen terugkoppeling.
- Rollen en toestemming: eigen account.
- Uitzonderingen: na vergeten kan de mens zijn kwesties niet meer terugvinden. De kwestie blijft bestaan.
- Acceptatiecriterium: Gegeven een kwestie die het kantoor afwees met bevoegdheid en reden, wanneer de inbrenger "Mijn kwesties" opent, dan ziet hij wie (codenaam), met welke bevoegdheid en waarom, en de trede gaat naar "gezien".

**KWE-03 Kwestie intrekken** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `intrek` (`lid.js`).
- Regels en rekenwijze: alleen de inbrenger, en niet als anderen volgen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de inbrenger. Volgers zijn er per definitie niet.
- Rollen en toestemming: inbrenger.
- Uitzonderingen: het kantoor heropent een ingetrokken kwestie niet.
- Acceptatiecriterium: Gegeven een kwestie met een volger, wanneer de inbrenger intrekt, dan krijgt hij 409 met de uitleg dat het kantoor kan afsluiten met een reden.

**KWE-04 Behandeling op naam, gesloten eindstanden, heropenen** · L3 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `behandel, sluit, heropen` (`index.js`), kantoorscherm `kwestiekantoor.html`.
- Regels en rekenwijze: zeven eindstanden, toelichting ≥ 15 tekens, verplichte velden per eindstand. Een eindstand verandert nooit achteraf.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: inbrenger en volgers via terugkoppeling. Het kantoor ziet alleen datums.
- Rollen en toestemming: kantoormedewerker met eigen account en codenaam, niet betrokken.
- Uitzonderingen: met de gedeelde kantoorcode weigert alles.
- Acceptatiecriterium: Gegeven een kantoormedewerker die zelf de kwestie inbracht, wanneer hij een eindstand wil zetten, dan krijgt hij 409 "U bent zelf betrokken".

**KWE-05 Wek en herbezorging** · L6 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `wek.js`, `meldLid`.
- Regels en rekenwijze: de wek noemt geen kwestie en geen uitkomst. `gewekt` alleen als de melding echt bezorgd is.
- Onzekerheid: herbezorgen is een kantoorhandeling. Er is geen automatische tweede poging (`WEK_EERLIJK`, grens).
- Wie hoort wat, wanneer: ontvangers van de eindstand.
- Rollen en toestemming: systeem; herbezorgen door het kantoor op naam.
- Uitzonderingen: rusttijden van het lid gaan voor.
- Acceptatiecriterium: Gegeven een lid met meldingen gedempt, wanneer zijn kwestie wordt afgesloten, dan staat de trede op "klaargezet" en niet op "gewekt", en de uitkomst is toch te lezen.

**KWE-06 Meter Niemand kwijt en bewijsstand** · L4/L5 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `meter.js`, `bewijsstand.js`.
- Regels en rekenwijze: per stand tellen, breuken apart en nooit opgeteld tot een percentage. "Vergeten" apart. Onbewezen beweringen staan erbij.
- Onzekerheid: de lijst zegt zelf wat niet bewezen is.
- Wie hoort wat, wanneer: kantoor (op naam).
- Rollen en toestemming: kantoor.
- Uitzonderingen: geen ranglijst van medewerkers of wijken (POLITIEK par. 11).
- Acceptatiecriterium: Gegeven een kwestie waarvan de tijdlijnketen met opzet is gewijzigd, wanneer het kantoor de meter leest, dan staat er één breuk "geschiedenis-gewijzigd" met het kwestienummer.

**KWE-07 DoeNetwerk: samen iets doen** · L3 · bestaat · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `democratieActies` (`doe.js`, `doe-bijeenkomst.js`, `samendoen.js`).
- Regels en rekenwijze: alleen wie de kwestie heeft start, met `zichtbaar: true`. Aantallen, nooit namen. Geen uitnodiging of herinnering. Bijeenkomst met plaatsgrens en zonder wachtlijst. Wie aansluit, wordt volger.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: leden zien openbare acties. Deelnemers zien de bijeenkomst in de lijst.
- Rollen en toestemming: starter plant, deelnemer antwoordt, het kantoor sluit met `samen-opgelost`.
- Uitzonderingen: "rollen invullen, benodigdheden en financiering niet" gebouwd (POLITIEK par. 18, fase E).
- Acceptatiecriterium: Gegeven een actie met een bijeenkomst voor 10 plaatsen en 10 keer "ja", wanneer een elfde lid "ja" kiest, dan krijgt hij "Het is vol" en ziet hij niet wie er komen.

**KWE-08 Partijvoorstellen met bron, toelichting en aannamelijst** · L2/L3 · bestaat · kosten klein · complexiteit hoog · aanbevolen nu
- Gegevens en bron: `democratiePartijen`, `democratieVoorstellen` (`partijen.js`, `partijrol.js`, `voorstellen.js`, `voorstelbeeld.js`).
- Regels en rekenwijze: bron verplicht. Aannamevelden alleen met bron van "onbekend" af. Hashketen per voorstel. Gelijke limieten. Dagelijkse rotatie op registernummer. Neutrale afwezigheid.
- Onzekerheid: RTG controleert de inhoud van de bron niet (zie KWE-11).
- Wie hoort wat, wanneer: elk lid bij een openbare kwestie of zijn eigen kwestie.
- Rollen en toestemming: een account met de partijrol (eenmalige koppelcode). Registratie door het kantoor op naam met de bron van een officiële registratie.
- Uitzonderingen: oude partijsleutels werken tot de migratie af is (einddatum 19 januari 2027).
- Acceptatiecriterium: Gegeven twee partijen met elk een voorstel bij dezelfde kwestie, wanneer twee leden op dezelfde dag kijken, dan zien ze dezelfde volgorde, en de volgende dag is die één plaats verschoven.

**KWE-09 Vergeten zonder geschiedenis te herschrijven** · L5 · bestaat · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `koppeling.vergeet`, `kern.democratieVergeet`.
- Regels en rekenwijze: de sleutel gaat weg, de regel blijft met `vergetenOp`. De partijrol vervalt mee.
- Onzekerheid: zijkanalen (volgorde, tijd van de wek) zijn niet gemeten (`ZIJKANALEN` onbewezen).
- Wie hoort wat, wanneer: de meter telt "vergeten" apart.
- Rollen en toestemming: het lid zelf.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een lid met twee kwesties, wanneer hij vergeten wordt, dan bestaan beide kwesties nog, toont de meter twee "vergeten" en nul breuken, en heeft de opslag geen sleutel meer naast die kwesties.

**KWE-10 Discussiekamer: argumentenkaart bij een openbare kwestie** · L1/L3 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen nu (alleen samen met KWE-13)
- Gegevens en bron: een nieuwe collectie `democratieBijdragen` binnen `kern/democratie/` (geen nieuwe laag): per openbare kwestie claims met soort `voor`, `tegen`, `vraag`, `aanvulling`, elk met een ouderclaim (zoals Kialo, zie b), auteur als **deelnemersnummer** uit `koppeling.js`, eigen hashketen. De kwestie krijgt alleen de regel "discussie geopend".
- Regels en rekenwijze: een claim die een feit beweert, vraagt een bronveld (mag "eigen ervaring" zijn, en dan staat het zo). **Geen likes, geen stemmen op claims, geen sortering op populariteit.** Volgorde op tijd of op structuur. Bewerken is een nieuwe regel (DO-10). Geen namen, alleen "deelnemer 3 in deze discussie" (nummer per discussie, niet per mens over discussies heen; DO-01).
- Onzekerheid: wat een deelnemer zegt is zijn bewering. Het scherm toont de broncontrolestand (KWE-11).
- Wie hoort wat, wanneer: alle leden met een account bij een openbare kwestie. De inbrenger kiest bij het openbaar maken of er een discussie bij mag.
- Rollen en toestemming: inbrenger zet de discussie aan. Elk lid draagt bij. Moderator (KWE-13) beperkt.
- Uitzonderingen: een jongere mag meedoen (POLITIEK par. 5) zonder progressie: geen tellers, badges of "meest gewaardeerd". Partijen doen niet mee als deelnemer; ze plaatsen voorstellen (KWE-08), zodat een partij geen deelnemer kan imiteren.
- Acceptatiecriterium: Gegeven een openbare kwestie met discussie, wanneer lid B een tegenclaim plaatst met een bron en lid C een vraag eronder, dan zien alle leden dezelfde boom in dezelfde volgorde, zonder namen en zonder tellers, en een gemelde claim (KWE-13) toont de motivering van de beperking in plaats van te verdwijnen.

**KWE-11 Broncontrole volgens één maatstaf** · L2/L4 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen nu
- Gegevens en bron: per bron (op een claim, een voorstel of een aannameveld) een controlerecord met vijf standen: `niet gecontroleerd` (standaard), `bron niet te openen`, `bron zegt dit`, `bron zegt dit niet`, `bron zegt iets anders` (met citaat), plus wie (codenaam), wanneer en waarom. Hashketen.
- Regels en rekenwijze: IFCN-principes (zie c): **dezelfde stappen voor elke partij en elke burger**, de controleur neemt geen beleidsstandpunt in, de bron en de redenering zijn herhaalbaar, en een correctie is een nieuwe regel. Gecontroleerd wordt of de **bron de bewering draagt**, niet of de bewering "waar" is. Er bestaat geen aggregaat per partij ("72% klopt"). Dat is een partijscore en verboden (DO-07). Selectie van wat gecontroleerd wordt: op volgorde van binnenkomst of op melding, en elke partij met hetzelfde aantal per periode, nooit op keuze van de controleur.
- Onzekerheid: "niet gecontroleerd" is geen "klopt" en geen nul. Het scherm zegt het zo.
- Wie hoort wat, wanneer: iedereen die de claim of het voorstel ziet. De partij krijgt de controle te zien en kan een toelichting plaatsen (bestaat als vorm in `toelicht`).
- Rollen en toestemming: een controleur is een kantoormedewerker op naam die niet betrokken is (dezelfde regel als `betrokken()`). Een tweede controleur bevestigt `bron zegt dit niet` vóór publicatie (twee mensen bij een negatieve uitkomst).
- Uitzonderingen: geen AI-controle als uitkomst. Een model mag hoogstens "mogelijk zonder bron" aanwijzen (POLITIEK par. 10, toegestaan).
- Acceptatiecriterium: Gegeven twee voorstellen van verschillende partijen met elk een bron, wanneer de controleur beide controleert, dan doorlopen beide dezelfde vijf standen met dezelfde velden, een toets met verwisselde partijnamen geeft hetzelfde beeld, en er is nergens een percentage per partij.

**KWE-12 Gesimuleerde debatten (altijd gemarkeerd)** · L4 · ontbreekt · kosten middel · complexiteit hoog · later (eigenaarsbesluit, fase H)
- Gegevens en bron: alleen de argumentenkaart (KWE-10), de partijvoorstellen met bron (KWE-08) en de broncontrole (KWE-11) van één kwestie. Een lokaal model (`LOCAL_AI_URL`). Uitvoer is een **document**, geen deelnemer.
- Regels en rekenwijze: rollen heten "Standpunt A", "Standpunt B", "Twijfelaar", **nooit** naar een echte persoon, partij, politicus of lid. Elke zin draagt de bron uit de kaart of het label "door de simulatie geformuleerd, geen bron". Bovenaan en bij elke beurt: **"Gesimuleerd debat — niemand heeft dit gezegd."** Geen conclusie, geen winnaar, geen stemadvies (DO-07, DO-13). Symmetrie: elk standpunt even veel beurten en tekens. `PARTY_AI_PARITY`: verwisselde partijnamen geven een gelijkwaardig resultaat. De uitvoer gaat niet de kaart in als claim en kan niet als citaat van een partij worden gedeeld (het deelbare beeld draagt het label in de afbeelding/tekst zelf).
- Onzekerheid: een simulatie is per definitie geen feit. Niets wat de simulatie zegt, telt als bewering in de broncontrole.
- Wie hoort wat, wanneer: een lid vraagt het zelf aan voor zichzelf. Er komt geen feed en geen push.
- Rollen en toestemming: het lid zelf. Het kantoor kan de functie alleen globaal uitzetten (`ALLEEN_GLOBAAL`-vorm).
- Uitzonderingen: geen simulatie tijdens een verkiezingsperiode zonder juridisch oordeel over Verordening 2024/900 (zie c). Met `RTG_EXTERNE_AI_UIT=1` en zonder lokaal model bestaat de knop niet. Geen invoer van profiel of geschiedenis van het lid (`kwestieProjectie`, POLITIEK par. 10: de functie **kan** geen mens ontvangen).
- Acceptatiecriterium: Gegeven een kwestie met drie claims en twee partijvoorstellen, wanneer een lid een gesimuleerd debat opent, dan draagt elke beurt het label "gesimuleerd", komt geen partij- of persoonsnaam als spreker voor, heeft elk standpunt evenveel beurten, en met verwisselde partijnamen is de uitvoer gelijkwaardig volgens de pariteitstoets.

**KWE-13 Melden en moderatie (DSA)** · L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu (voorwaarde voor KWE-10)
- Gegevens en bron: melding met reden, plaats, onderbouwing en verklaring te goeder trouw (DSA art. 16, zie c). Besluit met motivering, en bezwaar. Eigen collectie in `kern/democratie/`, behandeld op het kwestiekantoor.
- Regels en rekenwijze: een beperking is zichtbaar ("deze bijdrage is beperkt omdat …"), nooit stil verwijderd (DO-10). Gesloten lijst van redenen, net als de eindstanden. **Neutraliteit**: dezelfde regels voor elk standpunt. Een moderator beoordeelt gedrag en onrechtmatigheid, niet standpunt.
- Onzekerheid: geen automatische moderatie als eindoordeel. Een filter mag hoogstens een melding klaarzetten.
- Wie hoort wat, wanneer: melder en auteur krijgen het besluit op hun eigen lijst plus een wek.
- Rollen en toestemming: moderator op naam, niet betrokken. Bezwaar bij een tweede moderator.
- Uitzonderingen: de beschermingsdeur (HDI.md par. 7) blijft open. Een melding over een onveilige situatie gaat direct naar de beschermingsroute en niet in de wachtrij.
- Acceptatiecriterium: Gegeven een gemelde claim, wanneer de moderator hem beperkt met reden "persoonlijke aanval", dan ziet iedereen op die plek de reden in plaats van de tekst, krijgt de auteur de motivering en een bezwaarknop, en een tweede moderator kan het besluit herzien met een nieuwe regel.

**KWE-14 Overzicht van standpunten (sensemaking, geaggregeerd)** · L4 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: alleen claims en hun structuur in één discussie. Geen stemmen van personen (die bestaan niet in KWE-10).
- Regels en rekenwijze: groepering van **claims** naar onderwerp (lokaal model of handmatig door een gespreksleider), met een ondergrens van vijf bijdragen per groep. Nooit groepering van **mensen** (DO-01, DO-05, `NO_POLITICAL_PROFILE`). Het label: "voorlopige ordening, geen uitslag".
- Onzekerheid: een ordening is een interpretatie. Het scherm toont de ordening naast de volledige kaart, nooit in plaats ervan.
- Wie hoort wat, wanneer: alle deelnemers. De inbrenger en het kantoor krijgen hetzelfde beeld.
- Rollen en toestemming: gespreksleider (kantoor op naam) bevestigt een ordening vóór publicatie.
- Uitzonderingen: geen ordening onder vijf bijdragen.
- Acceptatiecriterium: Gegeven een discussie met 40 claims, wanneer de gespreksleider een ordening publiceert, dan staat bij elke groep het aantal claims en geen enkel deelnemersnummer, en groepen met minder dan vijf claims staan onder "overig, niet geordend".

**KWE-15 Doorsturen naar de gemeente en het uitdaagrecht voorbereiden** · L6 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: de eindstand `doorgestuurd` bestaat (eist `naar`). Wat ontbreekt is een **verwijzing** naar een melding in de gemeente-app (`overheid.gemeente-burger`), waarmee de burger zelf indient. Bij het uitdaagrecht (zie c) zet het DoeNetwerk een concept klaar met wat de groep wil overnemen.
- Regels en rekenwijze: RTG dient nooit in namens de burger. De burger bevestigt zelf (één menselijke bevestiging, want het bereikt een instantie). Wat "maatschappelijke partij" is, bepaalt de gemeente.
- Onzekerheid: participatieverordeningen verschillen per gemeente. Het scherm zegt "check de verordening van jouw gemeente".
- Wie hoort wat, wanneer: de inbrenger ziet "doorgestuurd naar gemeente X, volg het daar" met de verwijzing.
- Rollen en toestemming: de inbrenger dient in. Het kantoor stuurt door.
- Uitzonderingen: zonder gemeente-aansluiting blijft het een tekstverwijzing ("naar: gemeente X") zoals nu.
- Acceptatiecriterium: Gegeven een doorgestuurde kwestie, wanneer de inbrenger "Meld bij de gemeente" kiest, dan opent de gemeente-app met het onderwerp ingevuld, en pas na zijn bevestiging daar staat er in Kwesties "door jou ingediend".

**KWE-16 Eenvoudige taal (B1) en vertaling** · L5 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: kwestie, claims en voorstellen. Lokaal model (POLITIEK par. 10).
- Regels en rekenwijze: het origineel blijft leidend. De B1-versie draagt "vereenvoudigd". Pariteit tussen partijen.
- Onzekerheid: een vereenvoudiging kan betekenis verschuiven. Daarom altijd het origineel ernaast.
- Wie hoort wat, wanneer: elk lid kiest het zelf.
- Rollen en toestemming: geen.
- Uitzonderingen: zonder lokaal model "niet beschikbaar".
- Acceptatiecriterium: Gegeven een voorstel, wanneer een lid "B1" kiest, dan ziet hij de vereenvoudigde tekst met het label en het origineel één tik verder, en voor twee partijen met verwisselde namen is de lengte en de vorm gelijkwaardig.

**KWE-17 Offline inbreng door een gastheer (ter plaatse)** · L2 · ontbreekt · kosten klein · complexiteit midden · later
- Gegevens en bron: een kwestie of claim met herkomst `ter-plaatse` (DO-12), ingevoerd door een vrijwilliger of gastheer (bestaande rol `werk.vrijwilligerswerk`).
- Regels en rekenwijze: weegt exact even zwaar. De burger krijgt een papieren code waarmee hij de uitkomst later zelf kan lezen.
- Onzekerheid: wie de burger is, weet het systeem niet. Dat is de bedoeling.
- Wie hoort wat, wanneer: de burger via zijn code. Zonder code is de terugkoppeling op de ontmoetingsplek.
- Rollen en toestemming: gastheer op naam voert in. De burger stemt mondeling in en de gastheer bevestigt dat.
- Uitzonderingen: een kind zonder ouder kan ter plaatse inbrengen (POLITIEK par. 5) zonder dat er iets aan hem wordt gekoppeld.
- Acceptatiecriterium: Gegeven een gastheer in een buurthuis, wanneer hij een kwestie voor een bezoeker invoert, dan krijgt de bezoeker een code, staat de kwestie met herkomst "ter plaatse" in de meter, en telt hij in elke telling als één.

**KWE-18 Vergelijken per onderwerp zonder stemadvies** · L4 · half (voorstellen per kwestie bestaan) · kosten middel · complexiteit midden · later
- Gegevens en bron: voorstellen (KWE-08) en aannamelijsten.
- Regels en rekenwijze: de burger kiest zelf het kenmerk (kosten, termijn, bestuursniveau). Zelf sorteren mag op objectieve kenmerken. Geen score en geen "past bij jou". Klikgedrag per volgorde wordt nooit vastgelegd (`NO_ORDER_OPTIMIZATION`).
- Onzekerheid: lege aannamevelden staan op "onbekend", niet op nul.
- Wie hoort wat, wanneer: alle leden.
- Rollen en toestemming: geen.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven drie voorstellen over Wonen, waarvan één zonder kosteninschatting, wanneer een lid op kosten sorteert, dan staat dat voorstel onder "onbekend" en niet onderaan als goedkoopste of duurste.

**KWE-19 Toezeggingsregister** · L5 · ontbreekt · kosten middel · complexiteit hoog · later (fase G)
- Gegevens en bron: POLITIEK par. 8. Toezegging met letterlijke bron, externe verankering vanaf versie 1 (`server/lib/keten-anker.js`).
- Regels en rekenwijze: geen score. Een partij zet nooit zelf "nagekomen".
- Onzekerheid: "nagekomen" vraagt een bron of een besluit.
- Wie hoort wat, wanneer: alle leden.
- Rollen en toestemming: kantoor registreert op naam. De partij licht toe.
- Uitzonderingen: geen persoonsgegevens in het anker.
- Acceptatiecriterium: Gegeven een toezegging met bron, wanneer de partij een toelichting plaatst, dan staat die naast de toezegging en vervangt ze haar niet, en het anker van die dag bevat alleen een hash.

**KWE-20 Inbreng idempotent over een herstart heen** · L5 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: verzoeksleutel van de client op de koppelingsrij (zo staat de sluitweg in `bewijsstand.js`).
- Regels en rekenwijze: dezelfde sleutel en hetzelfde onderwerp geeft dezelfde kwestie terug. Dezelfde sleutel met een ander onderwerp geeft 409.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de inbrenger.
- Rollen en toestemming: geen.
- Uitzonderingen: de sleutel staat niet op de kwestie (DO-01).
- Acceptatiecriterium: Gegeven een inbreng waarvan het antwoord verloren ging en een server die herstartte, wanneer de client opnieuw verstuurt met dezelfde sleutel, dan bestaat er één kwestie, en `INBRENG_IDEMPOTENT` staat in de bewijsstand op "bewezen" met een toets.

**KWE-21 Burgerberaad-kamer voor een gemeente** · L3 · ontbreekt · kosten groot · complexiteit hoog · later (eigenaarsbesluit, extern)
- Gegevens en bron: de gemeente doet de loting (adresregister, zie c). RTG levert alleen een besloten kamer met een argumentenkaart (KWE-10), broncontrole (KWE-11), gespreksleider en een eindadvies als werk in de Library.
- Regels en rekenwijze: RTG loot niet en bezit geen adresregister. De deelnemers krijgen een uitnodigingscode van de gemeente.
- Onzekerheid: representativiteit is de verantwoordelijkheid van de organisator.
- Wie hoort wat, wanneer: deelnemers in de kamer. Het advies is openbaar.
- Rollen en toestemming: gemeente (organisator), gespreksleider, deelnemers.
- Uitzonderingen: geen gezinsdata, geen profielen.
- Acceptatiecriterium: Gegeven een gemeente met 100 gelote deelnemers, wanneer zij met hun code binnenkomen, dan zien alleen zij de kamer, en het gepubliceerde advies bevat geen deelnemersnummer.

**KWE-22 Stemadvies, partijscore of "betrouwbaarheid"** · L4 · niet doen
- Reden: verboden door DO-07 en POLITIEK par. 16 ("AI-stemadvies · partijranglijst"); de capability mag niet bestaan.

**KWE-23 Promotie of betaalde zichtbaarheid van een standpunt of partij** · L3 · niet doen
- Reden: `NO_PAID_RANKING` en Verordening 2024/900. Er komt geen betaalpad naar zichtbaarheid.

**KWE-24 Gesimuleerde stem van een echte persoon of partij** · L4 · niet doen
- Reden: de eigenaar sluit dit uit ("nooit namens een echte persoon of partij"), en het zou een nagebootste politieke uitspraak zijn.

### e. RTG-exclusief

1. **Van gesprek naar daad naar bewijs.** Een discussie (Kwesties) leidt tot een actie in het DoeNetwerk (Kwesties), een bijeenkomst die in de agenda van deelnemers kan worden gezet als zij dat zelf doen (Agenda, `agenda.afspraken`, verwijzing), een resultaat, en de eindstand `samen-opgelost` op naam (kwestiekantoor). Het verhaal wordt een werk in de Library met citatie (Library). Elke schakel heeft een eigen eigenaar. Er is alleen het kwestienummer als verwijzing.
2. **Broncontrole die ook de partijvoorstellen raakt.** Dezelfde controle (KWE-11) geldt voor een claim van een burger en voor een bron onder een partijvoorstel, met dezelfde vijf standen. Bij Kialo of Decidim staan die twee werelden los van elkaar.
3. **Niemand kwijt als belofte aan de deelnemer.** Geen marktleider uit b heeft een gesloten eindstandenlijst met een meter die nul onverklaarde kwesties vereist. Een discussie die eindigt, eindigt dus in een kwestie met reden en niet in stilte.
4. **Een kwestie die bij de gemeente verdergaat zonder dat RTG namens de burger handelt.** Kwesties zet klaar, de gemeente-app (`overheid.gemeente-burger`) is waar de burger zelf indient.
5. **Pseudonieme deelname zonder profiel.** Het inbrengersnummer per kwestie (en per discussie) maakt het onmogelijk om iemands politieke opvattingen over discussies heen op te tellen. Dat staat al als `PSEUDONIEM_SPOOR` bewezen en kan voor de discussiekamer worden overgenomen.

### f. Bouwstenen en ontbrekende koppelingen

Staat: `server/kern/democratie/*.js` (16 bestanden), `server/routes/democratie/index.js`, `kantoor.js`, `partij.js`, `public/apps/foundation/kwesties.html`, `samendoen.js`, `voorstelbeeld.js`, `kwestiekantoor.html`, toetsen genoemd in `bewijsstand.js` (`test/democratie.test.js`, `test/democratie-verlies.test.js`, `test/democratie-afhankelijk.test.js`, `test/democratie-aanval.test.js`, `test/democratie-grondwet.test.js`) en `test/partijmigratie.test.js` (genoemd in `partijrol.js`), `scripts/lib/voltooi/kwesties.js`, `server/lib/keten.js`, `server/lib/keten-anker.js`.

Ontbreekt, per koppeling:

| van → naar | soort | wat |
|---|---|---|
| Kwesties → Gemeente (`overheid.gemeente-burger`) | verwijzing | KWE-15. De burger dient zelf in |
| Kwesties → Agenda (`agenda.afspraken`) | verwijzing | een DoeNetwerk-bijeenkomst in de eigen agenda zetten, door het lid zelf |
| Kwesties → Library (`library.werk`) | verwijzing | uitkomst of advies als werk; Kwesties bewaart alleen de ref |
| Kwesties → levensgraaf | projectie | "mijn kwesties" als knoop (aantal en stand, **nooit** onderwerp in een projectie die anderen kunnen zien). Twijfel: aan de integrator voorleggen of een politieke kwestie überhaupt in een projectie mag (DO-05) |
| Kwesties → beschermingsroute | verwijzing | KWE-13 uitzondering, HDI.md par. 7 |
| Kwesties → lokaal model | dienst | KWE-12, KWE-14, KWE-16 via `LOCAL_AI_URL`; elke koppeling moet ook in `afhankelijkheden.js` (anders zakt `UNDECLARED_RTG_DEPENDENCY`) |
| Kwesties → ankerdienst | hash | KWE-19, en optioneel de broncontrole |
| `volwassen()` → Kwesties | regel lezen | alleen voor een formeel stemmen, als dat ooit komt; nu niet nodig |

Ontwerpgrenzen die de constitutionele suite al afdwingt en die nieuwe functies niet mogen breken: `ISSUE_PARTY_NEUTRALITY`, `PARTY_*_PARITY`, `NO_PERSUASION_CAPABILITY` (de woordenlijst moet ook de simulatie dekken), `NO_ORDER_OPTIMIZATION`, `HISTORY_IMMUTABLE`, `HUMAN_DECIDES`.

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| KWE-20 inbreng idempotent | nu | klein | midden | — |
| KWE-13 melden en moderatie | nu | middel | midden | kantoorrol op naam; DSA-toets (extern, jurist) |
| KWE-10 argumentenkaart | nu | middel | hoog | KWE-13; eigenaarsbesluit: discussie per openbare kwestie aan door de inbrenger |
| KWE-11 broncontrole | nu | middel | hoog | KWE-10 of KWE-08; kantoorrol "controleur"; pariteitstoets |
| KWE-16 B1 en vertaling | later | middel | midden | lokaal model |
| KWE-18 vergelijken per onderwerp | later | middel | midden | KWE-08 |
| KWE-17 offline ter plaatse | later | klein | midden | vrijwilligersrol |
| KWE-15 gemeente en uitdaagrecht | later | middel | midden | gemeente-app; participatieverordening per gemeente (extern) |
| KWE-14 sensemaking | later | middel | hoog | KWE-10; lokaal model; drempel vijf |
| KWE-12 gesimuleerde debatten | later | middel | hoog | KWE-10, KWE-11; fase H; eigenaarsbesluit; juridische toets 2024/900 |
| KWE-19 toezeggingsregister | later | middel | hoog | fase G; ankerdienst |
| KWE-21 burgerberaad-kamer | later | groot | hoog | KWE-10, KWE-11, KWE-13; gemeentecontract; eigenaarsbesluit |
| KWE-22, 23, 24 | niet doen | — | — | grondwet DO-07, NO_PAID_RANKING, eigenaar |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket "Echte discussiekamer, met bronnen": KWE-20, KWE-13, KWE-10, KWE-11, plus de bestaande KWE-01 t/m KWE-09. Alles woont in `server/kern/democratie/` als eigen collecties met dezelfde schrijver- en ketenvorm. Er komt geen nieuwe motor of laag bij. De nieuwe collecties en elke externe module komen in `afhankelijkheden.js`.

Wat de gebruiker daarna kan en nu niet:
- bij een openbare kwestie met anderen in gesprek gaan in een argumentenkaart (voor, tegen, vraag, aanvulling), pseudoniem, zonder likes of ranglijst;
- bij elke bewering zien of de bron is gecontroleerd en wat de controleur vond, met dezelfde maatstaf voor burgers en partijen;
- een bijdrage melden en een gemotiveerd besluit krijgen, met bezwaar;
- zeker zijn dat een opnieuw verstuurde inbreng geen tweede kwestie maakt.

Gesimuleerde debatten zitten **niet** in A: POLITIEK zet de assistent in fase H, en de eigenaar moet daarover beslissen.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **deliberatief huis**: van inbreng via gesprek, broncontrole, gesimuleerde verkenning, burgerberaad en gemeentelijke participatie naar een besluit met reden, toezeggingen die worden gevolgd, en resultaten die worden teruggekoppeld. Met dezelfde neutraliteitstoetsen.

Nieuwe professionele processen die RTG kan ondersteunen:

1. **Onafhankelijke broncontrole (factcheckredactie).** Wie: een factcheckredactie (eigen stichting of een externe IFCN-ondertekenaar). Proces: binnenkomst (melding of vaste steekproef per partij) → toewijzing aan een niet-betrokken controleur → bronnen opvragen → vijf standen → tweede lezer bij een negatieve uitkomst → publicatie → open correctie. Rol: controleur, eindredacteur. Genre: geen. Het dichtstbij is `journalistiek`. **Eigenaarsbesluit:** of de controle bij RTG ligt of bij een onafhankelijke partij (POLITIEK par. 1: "vier rechtspersonen, één muur" pleit voor buiten). Extern: eventueel IFCN-ondertekening (31 criteria, zie c).
2. **Gespreksleiding en moderatie als vak.** Wie: getrainde gespreksleiders en moderatoren. Proces: kamer openen → spelregels → actief begeleiden → samenvatting (KWE-14) bevestigen → moderatiebesluiten met motivering → DSA-transparantierapport (alleen geaggregeerd). **Eigenaarsbesluit:** rol op het kantoor of als externe partner. Wet: DSA.
3. **Burgerberaad als dienst voor gemeenten, provincies en waterschappen.** Wie: de overheid als opdrachtgever, een onafhankelijk lotingsbureau, gespreksleiders. Proces: opdracht en commitment vooraf (TNO-voorwaarde, zie c) → loting door de overheid of het bureau → besloten kamer → expertsessies met bronnen → broncontrole → advies (werk in de Library) → reactie van het bestuur als eindstand met reden → terugkoppeling aan elke deelnemer → heropenen bij nieuwe feiten. **Eigenaarsbesluit:** partnerkanaal voor overheden. Extern: contract en de participatieverordening van die overheid.
4. **Uitdaagrecht ondersteunen.** Wie: een buurtgroep (DoeNetwerk-actie) en de gemeente. Proces: actie → plan → wat de groep wil overnemen en met welk budget → de burger dient zelf in bij de gemeente → besluit van de gemeente → eindstand. Geld wordt klaargezet en nooit vanzelf verplaatst (GELD.md). **Eigenaarsbesluit:** of het DoeNetwerk "benodigdheden en financiering" krijgt (POLITIEK fase E, open).
5. **Gesimuleerde debatten als leermiddel.** Wie: leden, scholen (mediawijsheid, `rtf.mediawijs`), bibliotheken. Proces: kwestie → argumentenkaart → simulatie met fictieve standpunten → bespreking door echte mensen → reflectie. Geen progressie onder 18 en geen beoordeling van leerlingen ("leren is geen wedstrijd"). **Eigenaarsbesluit:** fase H openen. Extern: juridisch oordeel over Verordening 2024/900, in het bijzonder in verkiezingsperioden. **Vraagt een lokaal model** (nieuwe dienstkoppeling, besluit).
6. **Toezeggingen volgen (fase G).** Wie: het kantoor, partijen, controleurs. Proces: registreren met letterlijke bron → toelichting van de partij → besluiten en stemmingen koppelen → stand "nagekomen" alleen op bron of besluit → externe verankering. Extern: openbare bronnen van vertegenwoordigende organen.
7. **Verkiezingsdebat-infrastructuur voor alle partijen gelijk (fase J, buiten DemocratieOS volgens besluit 5).** Alleen te noemen. Het hoort volgens POLITIEK **niet** in deze app.

Wat per stap nodig is staat bij de punten. Alle onderdelen van B blijven onder de grondwet DO-01 t/m DO-13. Een onderdeel dat een partijscore, targeting of overtuigingsfunctie vraagt, vervalt (POLITIEK par. 2: "waar een functie botst met een regel, vervalt de functie").

### Ketens LOS en SAMEN

**LOS.** Als alle andere apps uit staan, werkt de burgerlus volledig: inbrengen, behandelen, eindstand, terugkoppeling via de eigen lijst, meter. Dat is ook de bedoeling van `afhankelijkheden.js`. Wat het scherm dan eerlijk zegt:
- zonder Berichten: "We konden je geen melding sturen. Je uitkomst staat hieronder." (de trede blijft `klaargezet`, en het kantoor kan herbezorgen);
- zonder codenaamdienst: het kantoor kan niet beslissen en krijgt "Wie over een kwestie beslist, doet dat onder een codenaam, en voor deze sessie is er geen";
- zonder lokaal model (straks): B1, simulatie en ordening bestaan niet, met "niet beschikbaar"; de kaart en de broncontrole werken door, want die zijn handwerk;
- zonder duurzame vastlegging: 503 en "Dit lukte niet; er is niets veranderd dat u niet terugziet".

**SAMEN — keten "Onveilige oversteek: van gesprek naar oplossing".**
1. Lid A brengt in: "Onveilige oversteek bij de school" — eigenaar Kwesties.
2. A maakt er een DoeNetwerk-actie van (zichtbaar, zonder naam) en zet de discussie aan (KWE-10) — eigenaar Kwesties.
3. Leden B t/m F plaatsen claims, met bron of "eigen ervaring" — eigenaar Kwesties.
4. Een partij koppelt een voorstel met bron en aannamelijst (KWE-08) — eigenaar Kwesties (partijdeur).
5. Een controleur controleert de bron onder het voorstel en onder twee claims (KWE-11) — eigenaar Kwesties (kwestiekantoor).
6. Lid G meldt een claim als persoonlijke aanval; de moderator beperkt hem met reden (KWE-13) — eigenaar Kwesties (kwestiekantoor).
7. A plant een bijeenkomst op de stoep bij de school; deelnemers zetten hem zelf in hun agenda — eigenaar Kwesties (DoeNetwerk); agenda-item Agenda (`agenda.afspraken`).
8. Het kantoor stuurt door naar de gemeente (`doorgestuurd`, `naar: gemeente X`); A dient zelf in via de gemeente-app (KWE-15) — eigenaar Kwesties (eindstand), gemeente-app (`overheid.gemeente-burger`) voor de indiening.
9. De gemeente plaatst een zebrapad. Een nieuwe ronde wordt geopend met het nieuwe feit en gesloten met `uitgevoerd` — eigenaar Kwesties (kwestiekantoor).
10. Iedereen die aansloot (volgers) krijgt de terugkoppeling: eerst op de eigen lijst, dan een wek — eigenaar Kwesties; bezorging Berichten (`comm.berichten`).
11. Een buurtbewoner schrijft het verhaal op als werk in de Library met het kwestienummer als verwijzing — eigenaar Library.

Storingen:
- **Moderatie onbemand (stap 6):** de melding staat op "ontvangen" met datum. De claim blijft zichtbaar met "gemeld, wacht op een moderator". De meter telt open meldingen (een tweede invariant naast Niemand kwijt). **Uitzondering:** een melding over een onveilige situatie gaat direct naar de beschermingsroute.
- **Controleur niet beschikbaar (stap 5):** alle bronnen staan op "niet gecontroleerd". Het scherm zegt dat letterlijk, zonder kleurtje dat op "fout" lijkt.
- **De partij trekt zich terug of wordt uitgeschreven:** het voorstel blijft staan met de stand van de partij erbij (DO-10, `partijen.js`).
- **Gemeente-app uit (stap 8):** de eindstand `doorgestuurd` staat er met "naar: gemeente X" als tekst, zoals nu. A ziet "indienen bij de gemeente lukt nu niet via RTG; je kunt het ook zelf bij de gemeente doen."
- **Berichten uit (stap 10):** terugkoppeling op `klaargezet`; de uitkomst is gewoon te lezen; het kantoor herbezorgt.
- **Een volger wordt vergeten:** zijn regel blijft met `vergetenOp`, de meter telt hem apart en meldt geen breuk.
- **Library uit (stap 11):** de kwestie is af en hangt niet van het werk af.

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | de burgerlus, de discussiekamer, de broncontrole en moderatie bestaan elk met UI. Elke "nu"-functie heeft een voltooiscenario | `scripts/lib/voltooi/kwesties.js` uitgebreid met discussie, controle en melding |
| professionele diepte | een controleur en een moderator kunnen hun hele proces doen op naam, met tweede lezer en bezwaar, zonder API-hulp | voltooiscenario met kantooraccounts; `boardroomWie` weigert de gedeelde code |
| levenscyclus | kwestie → discussie → actie → doorsturen → heropenen → eindstand → terugkoppeling → vergeten, met nul onverklaarde breuken | meter `NIEMAND_KWIJT` = 0 en een gelijkwaardige teller voor open meldingen |
| samenwerking en rollen | inbrenger, volger, deelnemer, partij, controleur, moderator, kantoor: geen rol kan de handeling van een andere doen, en wie betrokken is, beslist niet | BEVOEGD-kruisparen per rol; IDOR met een fixture zodat `inbreng` niet "onbereikbaar" blijft; `MACHTSNEUTRAAL` uitgebreid naar moderatie en controle |
| domeinintelligentie | elke AI-uitvoer is gelabeld (vereenvoudigd, gesimuleerd, voorlopige ordening), heeft pariteit tussen partijen, en kan geen mens als invoer ontvangen | `PARTY_AI_PARITY`, `NO_PERSUASION_CAPABILITY` uitgebreid met de simulatie, toets op label in elke beurt |
| los functioneren | met Berichten, gemeente, agenda, Library en model uit werkt de burgerlus en de kaart volledig, en het scherm zegt wat er ontbreekt | proef P1-vorm: diensten uit; `UNDECLARED_RTG_DEPENDENCY` = 0 |
| RTG-ketens | de keten "onveilige oversteek" loopt eind-tot-eind via verwijzingen; geen kwestietekst staat in een collectie van een andere app | ketenproef + scan op `democratieKwesties`-inhoud buiten de eigen collecties |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen blijven BEWEZEN; daarnaast POSTGRES_DURABILITY, INBRENG_IDEMPOTENT en ZIJKANALEN van onbewezen naar bewezen | APPWERKT.json, `bewijsstand.js` |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar volgens SCHERMEIGENAAR.json | wat Kwesties alleen verwijst (geen dubbele logica) |
|---|---|---|
| kwesties behandelen, meter, partijregister | `apps/foundation/kwestiekantoor.html`, capability `kantoor.democratie` | zelfde domein, andere deur. Moderatie en controle komen daar bij, niet in het ledenscherm |
| melding bij een uitkomst of besluit | `apps/comm.html`, capability `comm.berichten` | alleen de wek zonder inhoud. Het bewijs is de eigen lijst |
| een melding bij de gemeente indienen | `apps/gemeente.html`, capability `overheid.gemeente-burger` | alleen een verwijzing met het onderwerp. De burger bevestigt daar |
| een bijeenkomst in de eigen agenda | `apps/agenda.html`, capability `agenda.afspraken` | alleen datum, tijd en plaats als voorstel. Het lid zet hem zelf in |
| een uitkomst of advies als werk publiceren | `apps/library.html`, capability `library.werk` | alleen het kwestienummer |
| gegevens inzien en vergeten | `apps/mijn-gegevens.html`, capability `privacy.gegevens` | Kwesties levert de vergeet-haak (bestaat) en een export (ontbreekt) |
| vrijwilliger of gastheer voor offline inbreng | `apps/foundation/os-vrijwilliger.html`, capability `werk.vrijwilligerswerk` | alleen de rol "mag ter plaatse invoeren". Twijfel: aan de integrator voorleggen of die rol in die app of op het kwestiekantoor woont |
| mediawijsheid en gesimuleerde debatten als les | `apps/foundation/mediawijs.html`, capability `rtf.mediawijs` | twijfel: aan de integrator voorleggen (de simulatie hoort bij Kwesties; een les erover bij mediawijs, zonder kopie van de logica) |
| onderzoek naar participatie | `apps/livinglab.html`, capability `onderzoek.lab` | alleen geaggregeerde uitkomsten met ondergrens vijf, nooit kwestietekst van een mens. Twijfel: aan de integrator voorleggen (DO-05) |
| de beschermingsdeur bij onveilige situaties | HDI.md par. 7. Een scherm in SCHERMEIGENAAR.json niet vastgesteld | twijfel: aan de integrator voorleggen welk scherm de eigenaar is; Kwesties verwijst alleen |
| identiteit gekeurd voor een partijrol of formeel stemmen | `apps/verificatie.html`, capability `identiteit.verificatie` | alleen "gekeurd ja/nee" en `volwassen()`; geen eigen kopie van de leeftijdsregel |


---

## 12. Zorg (tab) — `tab:zorg`, `/apps/app.html` (stand `zorg`, adres `#tab=zorg`)

De zorgtab is de plek waar een lid zorg en welzijn regelt bij aanbieders in het ecosysteem: een spa of wellness (niet-medisch) en een kliniek met een huisarts en een fysiotherapeut (medisch). Het lid kiest een behandeling, een dag en een tijdslot, boekt en betaalt in één beweging via RTG Pay, deelt zijn medische context apart en tijdelijk met precies één kliniek, boekt een herstelpakket (behandeling plus hotelnachten) en annuleert wat hij niet meer wil. De kern is drieledig: de agenda van de behandelaar is de schaarste (één behandeling per behandelaar per slot), het zorgprofiel (allergenen, dieet) reist met toestemming mee, en medische context gaat nooit mee zonder een aparte, verlopende "ja" per aanbieder. De tab hoort bij FoundationOS en is zichtbaar voor elk eigen account (`public/apps/app-main/app-main-12a.js`, regel 83-84); boeken vraagt een pas (`careBoek` weigert `tier === 'guest'`), een intake delen vraagt een gekeurd paspoort (`maakPaspoortdeur` in `server/routes/member/persoonlijk-care.js`). Voor wie: leden die zorg of welzijn boeken, en aan de andere kant de behandelaar die via de zorgbalie ziet wie er komt.

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | NIET_GETEST | — (geen eigen adres; de proef gaat via `#tab=zorg` en de routes) | de tab heeft geen eigen URL; `scripts/lib/voltooi/tabzorg.js` noemt dat als grens |
| bedienbaar | NIET_GETEST | — | de proef loopt over de routes die app-main-13/14/15 aanroepen, niet door de knoppen |
| menselijk | NIET_GETEST | 3 stappen afgeleid | menselijk-afgeleid uit de voltooiproef, niet uit een mensenproef |
| voltooibaar | GEEN_FIXTURE | sluit, 8 stappen | aanbod zien; boeken+betalen (één zorgregel in RTG Pay, bedrag = prijs × 100 centen); intake delen/stoppen; pakket in twee betalingen die samen de pakketprijs zijn; annuleren met vrijgekomen slot; drie bevoegdheidsstappen (zonder account 401, ander lid 404, kind met gezinssessie 401) |
| waarheidsgetrouw | NIET_GETEST | — | liegronde heeft de tab niet bereikt |
| persistent | GEEN_FIXTURE | sluit, 3 stappen | na herstart betaald en deling actief; read-only lezer vindt de medische context nergens leesbaar, ook niet met de opslagsleutel; nieuwe sessie ziet dezelfde afspraak |
| bevoegd | NIET_GETEST | (afgedekt in voltooibaar) | BEVOEGD.json: NIET_GETEST (geen eigen adres). IDOR.json: care 11 routes gescheiden, 6 publiek |
| herstelbaar | GEEN_FIXTURE | sluit, 4 stappen | dubbele tik boeken → 200/409 en één afspraak; dubbele tik betalen → één zorgregel; afgebroken annulering herhaalbaar; SIGKILL na betalen verliest niets |

Wat de code doet (gelezen):

- **Routes ledenkant** (`server/routes/member/persoonlijk-care.js`): `POST /api/care` (overzicht), `/api/care/boek`, `/betaal`, `/annuleer`, `/mijn`, `/intake/deel` (achter de paspoortdeur), `/intake/stop`, `/vastleggen/deel|stop|mijn`, `/wachtlijst`, `/wachtlijst/zet|af`, `/pakketten`, `/pakket/boek|betaal|mijn`. Boeken en pakket boeken gaan langs `gegevensStop(req, res, 'reservering')`.
- **Routes aanbiederkant** (`server/routes/supplier/care.js`): `/api/supplier/care/agenda`, `/afronden`, `/nietverschenen`, `/gemist`, `/vastleggen`, alle achter `supplierAuth` en gebonden aan de eigen `supplierCode`.
- **Kern** `server/kern/care.js` met deelbestanden: `care/leden.js` (intake delen/stoppen, overzicht, boeken met slotbotsing 409, betalen via `ctx.betaalZaak` met idem-sleutel `care:<ref>`, verval na 30 minuten met 410, annuleren, mijn), `care/zaak.js` (dagagenda, afronden, pakketcatalogus met eerlijk berekend voordeel tegen de goedkoopste kamer, Rahul-actie `boekBehandelingActie`), `care/pakketbetaal.js` (eigenaarsbesluit 19 oktober 2026 optie c: verdeling naar verhouding van de losse prijzen, afronding bij het hotel, twee boekingen `carepakket:<ref>:zorg|hotel`, stand `deels-betaald` als de tweede weigert), `care/intakesleutel.js` (AES-256-GCM per veld, AAD gebonden aan de rij, dicht falen), `care/wachtlijst.js` (seintje bij vrijgekomen slot, niemand wordt automatisch ingeboekt; niet-verschenen per aanbieder, nooit een cijfer dat met het lid meereist), `care/vastleggen.js` (tweede, aparte toestemming waarmee een behandelaar via een afspraakreferentie een meting in het dossier van het lid zet; het lid krijgt bericht), `care/opslag.js` (zeven eigen collecties via `kern/eigencollectie.js`).
- **Geld** `server/kern/pay/zaakbetaling.js`: `betaalZaak` (lid → zaak, met automatische bijlading en alles-of-niets bij een RTG-bijlage) en `terugZaak` (terugweg, kan eerlijk weigeren als de zaak te weinig saldo heeft).
- **Elders gelezen**: `kern/consent.js` kan een care-intake intrekken (`laag === 'care-intake'`); `kern/tijdlijn.js`, `kern/dagcoach.js` en `kern/life.js` lezen `careMijn` als bron "Zorg"; `kern/zelfzorg/opruimen.js` zet verlopen intakes op `verlopen`.
- **Tests**: `test/care.test.js`, `test/carebetaal.test.js`, `test/carepakket.test.js`, `test/care-intake-versleuteld.test.js`.
- **Schermen**: app-main-13 (mijn afspraken, intakes, pakketten), app-main-14 (aanbod, intake-kaart bij een kliniek, boeken+betalen), app-main-14a/b (verzorging: kapper/barbier/nagels, bewust zonder zorgprofiel), app-main-15 (pakketknoppen). Zorgbalie aanbiederkant: `public/apps/leverancier/leverancier-77.js` (alleen `agenda` en `afronden`).

Bevindingen bij het lezen (feiten, geen oordeel over de proef):
1. **Annuleren betaalt niet terug.** `careAnnuleer` (`care/leden.js`) zet alleen `status = 'geannuleerd'`; er staat geen aanroep van `terugZaak`, terwijl die in `kern/pay/zaakbetaling.js` klaarstaat. Een betaalde, geannuleerde afspraak laat het geld bij de zaak.
2. **Wachtlijst, vastlegtoestemming, niet-verschenen en gemist hebben geen scherm.** Een grep op `public/` vindt geen aanroep van `/api/care/wachtlijst*`, `/api/care/vastleggen*`, `/api/supplier/care/nietverschenen`, `/gemist` of `/vastleggen`.
3. **De melding na een gemiste afspraak belooft een instelling die ik niet vond**: "Wilt u uw herinnering voortaan eerder? Dat zet u zelf om bij uw afspraken" (`care/wachtlijst.js`). In `kern/care*` en app-main-13 staat geen herinneringsinstelling.
4. **De medische aanbieder hangt niet aan een bewijsgenre.** Kliniek Clara is in `server/seed/leveranciers.js` van type `zorg` (genre "Zorg & welzijn", status `open`), terwijl zij "Consult huisarts" en "Fysiotherapie" aanbiedt. `huisarts` en `fysiotherapie` zijn wél bewijsgenres (`server/seed/genres-lijst-a.js`, `server/kern/aanmeldingen/bewijs.js`).
5. **De aanbiedercatalogus is seed.** `careAanbieders` wordt alleen in `lijsten()` gevuld; er is geen route waarmee een aanbieder zijn behandelingen, prijzen of tijden zet.
6. `docs/care.md` sectie "Vervolg (bewust nog niet gedaan)" noemt de leden-tab, de aanbiederkant en de pakketten als nog niet gedaan; de secties erboven en de code zeggen dat ze bestaan. Het document spreekt zichzelf tegen.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Zocdoc (VS, artsen) | Marketplace per boeking; duurste: Sponsored Results (veilingmodel) | per nieuwe patiënt $35–$110 naar specialisme, jaarlicentie $299 (berichtgeving 2018, New York); Sponsored Results: prijs niet openbaar | online boeken bij artsen, alleen nieuwe patiënten betaald, maandplafond, zichtbaarheid pauzeren, kwijtschelding bij annulering binnen 24 uur, gesponsorde plaatsing | Zocdoc — https://www.zocdoc.com/ (zoekresultaat 2026-10-19, pagina niet geopend); Fierce Healthcare — https://www.fiercehealthcare.com/practices/some-new-york-doctors-unhappy-about-zocdoc-s-new-pricing-model-company-says-it-was (zoekresultaat 2026-10-19, pagina niet geopend); Zocdoc Paper Gown — https://thepapergown.zocdoc.com/facts/pay-per-booking-fees-explained/ (zoekresultaat 2026-10-19, pagina niet geopend); Zocdoc blog — https://www.zocdoc.com/blog/facts/national-reach-provider-acquisition/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Treatwell (Europa, salon/wellness) | Starter, Advanced; duurste: geen gegevens | Duitsland Starter €39/mnd, Advanced €49/mnd (aggregator); 35% + btw op de eerste boeking van een nieuwe klant via de marktplaats; online vooruitbetaling 2% (NL-pagina) | agenda + marktplaatsvermelding, herhaalboekingen zonder commissie, boekknop op eigen site, vooruitbetaling, sms-herinneringen (tegenstrijdig gemeld) | Treatwell partners — https://www.treatwell.nl/en/partners/solutions/salon-software/ (zoekresultaat 2026-10-19, pagina niet geopend); Treatwell partners — https://treatwell.nl/en/partners?p=45 (zoekresultaat 2026-10-19, pagina niet geopend); Capterra — https://www.capterra.com/p/181827/Treatwell/pricing/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Doctolib (Europa, artsen) | vier pakketten; duurste: topvariant | geen officiële prijs; aggregator noemt topvariant €199–€298 per maand per behandelaar plus opstartkosten; oudere Franse bron €135/mnd + €129 online afspraken + €79 teleconsult | online afspraken, videoconsult (al in kleinste pakket), patiëntendossier en declaratie pas in hogere pakketten; patiënt betaalt niets | Pabau — https://pabau.com/de/blog/doctolib-kosten/ (zoekresultaat 2026-10-19, pagina niet geopend); Spendbase — https://www.spendbase.co/nl/?p=38167 (zoekresultaat 2026-10-19, pagina niet geopend); Le Quotidien du Médecin — https://medecine-generale.lequotidiendumedecin.fr/liberal/exercice/la-licorne-doctolib-lance-son-offensive-sur-le-marche-du-logiciel-medical (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| zoeken en boeken in een echte agenda met slotbotsing | ja |
| direct betalen bij boeken | ja (RTG Pay, echt geld in de simulatiebank) |
| kosteloos annuleren binnen een termijn, met geld terug | half (annuleren ja, terugbetalen nee; geen termijnregel) |
| wachtlijst bij vrijgekomen slot | half (kern en API ja, scherm nee) |
| herinneringen vooraf | nee (alleen een melding na betalen) |
| aanbieder beheert zelf aanbod, prijzen en tijden | nee (seed) |
| medische context vooraf delen met de behandelaar | ja, en sterker dan de leiders: per aanbieder, verlopend, per veld versleuteld |
| no-show-registratie | half (API, geen scherm), bewust zonder lidcijfer |
| beoordelingen/sterren | nee, en bewust niet: zie ZRG-17 |
| videoconsult | nee (later, zie Uitkomst B) |
| declaratie/betaalbewijs voor verzekeraar | nee |
| gesponsorde plaatsing | nee, en niet doen (zie ZRG-24) |

### c. Het volledige domein

**Particulier.** Een mens boekt zorg op drie manieren: zelf (wellness, fysiotherapie zonder verwijzing, een consult), na een verwijzing (specialist, soms fysio), of voor een ander (een ouder voor een kind, een mantelzorger voor een ouder). Wat hij wil: snel een vrij moment, zekerheid dat de behandelaar bevoegd is, weten wat het kost en of het terugkomt van de verzekeraar, de behandelaar vooraf iets laten weten (allergie, bloedverdunner), en bij verhindering kosteloos verzetten.

**Professioneel.** Een praktijk werkt met een agenda per behandelaar, een balie die plant maar niet behandelt, en behandelaars die bevoegd moeten zijn. Voorbehouden handelingen mag een zorgverlener zonder de juiste registratie niet zelfstandig verrichten; het BIG-register is openbaar te raadplegen en geregistreerden moeten elke vijf jaar herregistreren. Bron: Rijksoverheid, bevoegdheid zorgverlener — https://www.rijksoverheid.nl/vraag-en-antwoord/voorbehouden-handelingen/bevoegdheid-zorgverlener (zoekresultaat 2026-10-19, pagina niet geopend); Rijksoverheid, inzage BIG-register — https://www.rijksoverheid.nl/wetten-en-regelingen/productbeschrijvingen/inzage-big-register (zoekresultaat 2026-10-19, pagina niet geopend). Fysiotherapeut is volgens het register van dit huis een artikel 3-beroep in de Wet BIG (`server/kern/persoonseis-lijst.js`); dat staat in de code en ik heb het niet in een zoekresultaat teruggezien.

**Organisatorisch.** Onder de Wkkgz moet elke zorgaanbieder een klachtenregeling hebben, een onafhankelijke klachtenfunctionaris waar belanghebbenden kosteloos terechtkunnen, binnen zes weken een oordeel geven en aangesloten zijn bij een door de minister erkende geschilleninstantie. Bron: DC Klinieken reglement — https://www.dcklinieken.nl/wp-content/uploads/Klachten-en-suggesties/2190810-DC-Klinieken-Reglement-klachtenbehandeling.pdf (zoekresultaat 2026-10-19, pagina niet geopend); VGN notitie Wkkgz — https://www.vgn.nl/files/article/docs/561f5b38eb2d7-Notitie%20nieuwe%20verplichtingen%20Wkkgz.docx (zoekresultaat 2026-10-19, pagina niet geopend). Het medisch dossier (WGBO) wordt twintig jaar bewaard; de patiënt heeft recht op inzage en afschrift. Bron: Consumentenbond — https://www.consumentenbond.nl/je-rechten-als-patient/medisch-dossier (zoekresultaat 2026-10-19, pagina niet geopend); Kamerstuk 34994 nr. 3 — https://zoek.officielebekendmakingen.nl/kst-34994-3.pdf (zoekresultaat 2026-10-19, pagina niet geopend). Gezondheidsgegevens zijn bijzondere persoonsgegevens; uitdrukkelijke toestemming is een van de uitzonderingen in artikel 9 lid 2 sub a AVG, en toestemming moet vrij, specifiek, geïnformeerd en ondubbelzinnig zijn, met intrekken even makkelijk als geven. Bron: Legiscope — https://www.legiscope.com/blog/bijzondere-persoonsgegevens-avg.html (zoekresultaat 2026-10-19, pagina niet geopend). Een persoonlijke gezondheidsomgeving die gegevens met zorgaanbieders uitwisselt, kan het MedMij-label halen (daarnaast o.a. NEN 7510). Bron: Kiwa — https://www.kiwa.com/nl/nl/diensten/certificering/medmij-keurmerk-voor-persoonlijke-gezondheidsomgevingen/ (zoekresultaat 2026-10-19, pagina niet geopend).

**Wellness en spa** vallen niet onder de Wet BIG zolang er geen voorbehouden handeling gebeurt; het huis legt dat vast met `beautymedical` (bewijsgenre, `verwijzen` vraagt `cosmetisch`) tegenover `wellness` (open genre).

**Wat daaruit volgt voor de app.**
1. Een medische behandeling hoort alleen te boeken zijn bij een aanbieder in een bestaand bewijsgenre (huisarts, specialist, ziekenhuis, fysiotherapie, sportarts, beautymedical), en de app moet dat zichtbaar maken als "een mens van RTG heeft het stuk gezien", nooit als "RTG heeft gecontroleerd" (CLAUDE.md, persoonseis).
2. De klachtroute van de aanbieder (Wkkgz) hoort bij elke medische afspraak te staan als verwijzing naar de aanbieder; RTG behandelt geen zorgklachten.
3. RTG is geen dossierhouder in de zin van de WGBO; de intake is een mededeling van het lid aan de aanbieder, de vastlegging een meting met herkomst. Het dossier blijft in het systeem van de aanbieder.
4. Toestemming per doel en per aanbieder, verlopend en even makkelijk in te trekken: dit staat er al, en het is het sterkste deel van de tab.
5. Geld: annuleren binnen de termijn van de aanbieder hoort het geld terug te zetten via `terugZaak`.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk**: sterk; boeken, betalen, intake en pakket bestaan en zijn bewezen voltooibaar, maar terugbetalen bij annuleren en een herinnering ontbreken.
- **L2 Professioneel via bestaande genres**: zwak; de kliniek staat in het open genre `zorg` in plaats van een bewijsgenre, en de helft van de zorgbalie (niet-verschenen, vastleggen) heeft geen scherm.
- **L3 Organisatorisch**: afwezig; de aanbieder kan zijn eigen aanbod, tijden en annuleringsvoorwaarden niet beheren.
- **L4 Domeinintelligentie**: bewust smal en dat is goed; geen triage, geen score; wat kan is feitelijk (eerstvolgend vrij slot) en voorbereidingsvragen per behandelingssoort zonder oordeel.
- **L5 Volledige levenscyclus**: half; voor en tijdens bestaat, na (nazorg, betaalbewijs, terugbetaling) ontbreekt grotendeels.
- **L6 RTG-samenhang**: half; tijdlijn, dagcoach, life en consent lezen Care al, maar de agenda, de mantelzorgmachtiging en de Foundation-deeplink zijn niet rond.

**ZRG-01 Aanbod zien, boeken en betalen** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (alleen onderhoud)
- Gegevens en bron: `careAanbieders` (seed), `careBoekingen`; betaling via `pay.betaalZaak`.
- Regels en rekenwijze: één behandeling per behandelaar per slot (409); datum vanaf vandaag; slot moet in `tijden` staan; boeking vervalt na 30 minuten onbetaald (410); bedrag = prijs × 100 centen.
- Onzekerheid: geen; de prijs staat vast in de catalogus.
- Wie hoort wat, wanneer: lid krijgt na betalen een melding met dag, tijd en behandelaar; aanbieder ziet de afspraak pas in zijn agenda als hij betaald is.
- Rollen en toestemming: lid met pas; gast 403; kind met gezinssessie 401.
- Uitzonderingen: aanbieder zonder `supplierCode` → 409 "er is niets afgeschreven"; RTG Pay niet aangesloten → 503.
- Acceptatiecriterium: Gegeven een lid met pas en een vrij slot, wanneer hij boekt en betaalt, dan staat de afspraak als `geboekt` en `paid`, staat er precies één zorgregel ter waarde van de prijs in RTG Pay, en krijgt een tweede lid op hetzelfde slot 409.

**ZRG-02 Annuleren met vrijgekomen slot** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `careBoekingen.status`, `careWachtlijst`.
- Regels en rekenwijze: alleen eigen boeking; tweede annulering 409; `slotVrij` seint de wachtlijst, falen van de wachtlijst houdt de annulering niet tegen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: wachtenden krijgen direct een seintje; het lid krijgt `wachtlijstGewekt` terug.
- Rollen en toestemming: alleen het lid zelf (ander lid 404).
- Uitzonderingen: annuleren na afronden is niet afgevangen (de code kent die check niet; zie ZRG-03).
- Acceptatiecriterium: Gegeven een betaalde afspraak, wanneer het lid annuleert, dan verdwijnt hij uit "mijn afspraken" en kan een ander lid hetzelfde slot boeken.

**ZRG-03 Terugbetalen bij annuleren, met de termijn van de aanbieder** · L1 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: `bk.betaling.centen` (staat al op de boeking), `terugZaak` in `kern/pay/zaakbetaling.js`, idem-sleutel `care-terug:<ref>`.
- Regels en rekenwijze: binnen de kosteloze termijn (ZRG-14) gaat het volle bedrag terug; buiten de termijn alleen wat de aanbieder als voorwaarde publiceerde; nooit annuleren na `afgerond`. Weigert `terugZaak` (zaak te weinig saldo), dan blijft de boeking geannuleerd en staat er eerlijk "terugbetaling open" met de zin uit `terugZaak`.
- Onzekerheid: de saldoweigering is reëel; geen stille terugval.
- Wie hoort wat, wanneer: lid direct (bedrag terug of open); aanbieder via `sseToSupplier`.
- Rollen en toestemming: het lid start; geen tweede mens nodig (het is afwikkeling van zijn eigen betaling).
- Uitzonderingen: pakket: beide delen naar verhouding terug (`pb.verdeling`), met dezelfde afronding bij het hotel.
- Acceptatiecriterium: Gegeven een betaalde afspraak binnen de kosteloze termijn, wanneer het lid annuleert, dan staat er in RTG Pay één terugregel van hetzelfde bedrag, en een dubbele tik geeft geen tweede terugregel.

**ZRG-04 Medische intake apart delen, verlopend, stopbaar** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `careIntake`, per veld versleuteld (`care/intakesleutel.js`, sleutel buiten de database, AAD = rij).
- Regels en rekenwijze: max 600 tekens; 90 dagen; bijwerken in plaats van stapelen; boeking krijgt een eigen versleutelde kopie gebonden aan `boeking|<id>`; dicht falen (503, niets gedeeld).
- Onzekerheid: wat het lid typt is zijn eigen mededeling, geen gevalideerd medisch feit.
- Wie hoort wat, wanneer: lid krijgt een melding met de vervaldatum; behandelaar ziet de tekst alleen in zijn dagagenda bij een betaalde afspraak.
- Rollen en toestemming: account met gekeurd paspoort (paspoortdeur, SAMENLEVING-besluit 4c); stoppen alleen door het lid.
- Uitzonderingen: verlopen intakes worden door `zelfzorg/opruimen.js` op `verlopen` gezet.
- Acceptatiecriterium: Gegeven een gedeelde intake, wanneer een read-only lezer de opslag doorzoekt, dan staat de tekst nergens leesbaar, en na stoppen staat de deling niet meer in het overzicht.

**ZRG-05 Vastlegtoestemming op het scherm** · L1 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `careVastlegging`, routes `/api/care/vastleggen/*` (bestaan), metingen via `kern/metingen.js` (`metingVanBehandelaar`).
- Regels en rekenwijze: tweede, aparte schakelaar per aanbieder, met de uitleg uit de code ("Wat er al staat blijft; dat is echt gemeten").
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid krijgt bij elke vastlegging een melding met onderwerp en waarde.
- Rollen en toestemming: lid zet aan/uit; behandelaar schrijft alleen via de referentie van een eigen afspraak.
- Uitzonderingen: intrekken wist niets wat al gemeten is (bewuste keuze in `care/vastleggen.js`).
- Acceptatiecriterium: Gegeven een kliniekkaart in de tab, wanneer het lid "laat deze kliniek metingen vastleggen" aanzet en weer uitzet, dan geeft `/api/supplier/care/vastleggen` eerst 200 en daarna 403.

**ZRG-06 Wachtlijst op het scherm** · L1 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `careWachtlijst`, routes bestaan.
- Regels en rekenwijze: per aanbieder; geen voorrang, geen wachtnummer; wie het eerst boekt heeft het.
- Onzekerheid: of er iets vrijkomt is onbekend; het scherm belooft niets.
- Wie hoort wat, wanneer: seintje bij een annulering.
- Rollen en toestemming: lid met pas.
- Uitzonderingen: nooit automatisch inboeken (vastgelegd besluit in `care/wachtlijst.js`).
- Acceptatiecriterium: Gegeven een lid op de wachtlijst van Zenith, wanneer een ander lid een Zenith-afspraak annuleert, dan krijgt het eerste lid één melding en staat er niets nieuws in zijn afspraken.

**ZRG-07 Herstel- en verblijfpakket** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (onderhoud)
- Gegevens en bron: `carePakketten`, `carePakketBoekingen`, hotelnachtprijs uit `db.data.suppliers[].rooms`.
- Regels en rekenwijze: eigenaarsbesluit 19 oktober 2026 optie c (naar verhouding, afronding bij het hotel); verdeling vastgelegd bij eerste poging.
- Onzekerheid: het "bespaar"-bedrag rekent tegen de goedkoopste kamer, met terugval 400 als het hotel geen kamers heeft (`nachtprijsVan`). Die terugval is een aanname en geen gemeten prijs; het scherm zegt dat nu niet.
- Wie hoort wat, wanneer: lid na volledige betaling; bij `deels-betaald` een eerlijke zin.
- Rollen en toestemming: lid met pas.
- Uitzonderingen: tweede betaling weigert → herhalen met dezelfde sleutels.
- Acceptatiecriterium: Gegeven een pakket van € 995, wanneer het lid betaalt, dan staan er twee regels (behandeling en verblijf) die samen exact 99500 centen zijn.

**ZRG-08 Herinnering vooraf, door het lid zelf ingesteld** · L1 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de boeking (datum, tijd); voorkeur per lid; bezorging via de bestaande `notify`.
- Regels en rekenwijze: standaard één herinnering (bijv. de dag ervoor); het lid kiest zelf eerder of later of uit. Dit maakt de belofte in de niet-verschenen-melding waar.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: alleen het lid.
- Rollen en toestemming: het lid.
- Uitzonderingen: geen herinnering voor een geannuleerde of afgeronde afspraak.
- Acceptatiecriterium: Gegeven een afspraak morgen om 10:00 en een herinnering "dag ervoor", wanneer de dag ervoor aanbreekt, dan krijgt het lid één melding, en na annuleren geen.

**ZRG-09 Medisch alleen bij een bewijsgenre** · L2 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `findSupplier(code).type`, `kern/aanmeldingen/bewijs.js` (`bewijsKlaar`), `seed/genres-lijst-a.js`.
- Regels en rekenwijze: een behandeling met `soort: 'medisch'` is alleen boekbaar als de aanbieder in een bewijsgenre staat en `bewijsKlaar` waar is; anders verdwijnt hij uit het aanbod met de zin "nog niet beschikbaar". Kliniek Clara verhuist van genre `zorg` naar `huisarts` (consult) en een fysiotherapiezaak (fysio); dat is een seedwijziging binnen bestaande genres.
- Onzekerheid: "gezien door een mens van RTG" is geen validatie; het scherm zegt precies dat.
- Wie hoort wat, wanneer: lid ziet bij de aanbieder "Vergunning gezien door RTG op <datum>"; aanbieder krijgt bij verlopen bewijs de herkeuring (`bewijsHerkeuring`).
- Rollen en toestemming: medewerker van RTG tekent af, nooit de werkgever zelf.
- Uitzonderingen: wellness en spa blijven in het open genre `wellness`.
- Acceptatiecriterium: Gegeven een aanbieder van type `zorg` met een medische behandeling, wanneer een lid het aanbod opent, dan staat die behandeling er niet, en na verhuizing naar `huisarts` met afgetekend bewijs wel.

**ZRG-10 De zorgbalie compleet: niet-verschenen, gemist, vastleggen** · L2 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: routes `/api/supplier/care/nietverschenen|gemist|vastleggen` (bestaan), scherm `leverancier-77.js` (kent alleen agenda en afronden).
- Regels en rekenwijze: niet-verschenen alleen voor een afspraak die geweest is; telling per aanbieder; nooit per lid door het huis.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid krijgt bij niet-verschenen een aanbod, geen berisping; bij vastleggen onderwerp en waarde.
- Rollen en toestemming: zaakaccount via `supplierAuth`; vastleggen alleen met toestemming van het lid (ZRG-05).
- Uitzonderingen: toekomstige afspraak → 400.
- Acceptatiecriterium: Gegeven de zorgbalie van Clara met een afspraak van gisteren, wanneer de balie "niet verschenen" kiest, dan ziet Clara hem in "gemist" en ziet Zenith hem niet.

**ZRG-11 Persoonseis voor de behandelaar die vastlegt** · L2 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: `kern/persoonseis.js` (`magWerkenHier`, `persoonVanActor`), vakbewijs in de kluis.
- Regels en rekenwijze: het WERK in een medisch genre vraagt een vastgestelde identiteit (dat geldt al per genre); vastleggen hoort te gebeuren door een persoonlijke inlog en niet door een gedeelde zaakinlog. Er komt géén nieuwe handeling in het register zolang er geen voorbehouden handeling door de software loopt (LAT-regel 6, zoals bij verzekeringen).
- Onzekerheid: de zaaksessie (`supplierAuth`) zegt nu niet welke mens schrijft; dat is de open vraag.
- Wie hoort wat, wanneer: lid ziet de naam van de behandelaar bij de meting.
- Rollen en toestemming: behandelaar met eigen inlog.
- Uitzonderingen: een balie mag plannen en niet-verschenen noteren zonder BIG.
- Acceptatiecriterium: Gegeven een gedeelde zaakinlog zonder persoon, wanneer die een meting vastlegt, dan weigert de server met de zin uit `persoonseis.js` over een persoonlijke inlog.

**ZRG-12 Klachtroute van de aanbieder (Wkkgz) als verwijzing** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: per aanbieder drie velden die de aanbieder zelf invult (klachtenfunctionaris, geschilleninstantie, link naar de regeling).
- Regels en rekenwijze: alleen tonen wat de aanbieder opgaf; ontbreekt het bij een medisch genre, dan staat er "deze aanbieder heeft zijn klachtenregeling nog niet opgegeven", nooit een verzonnen instantie.
- Onzekerheid: RTG controleert de inhoud niet en zegt dat.
- Wie hoort wat, wanneer: lid bij elke medische afspraak en na afronden.
- Rollen en toestemming: aanbieder vult, lid leest.
- Uitzonderingen: wellness: geen Wkkgz-verplichting gemeld; daar de gewone servicelijn van de zaak (`service.hulp`).
- Acceptatiecriterium: Gegeven een afgeronde medische afspraak, wanneer het lid de afspraak opent, dan ziet hij de klachtroute van die aanbieder of de zin dat die ontbreekt.

**ZRG-13 Aanbieder beheert eigen aanbod, prijzen en tijden** · L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `careAanbieders` (nu seed), schrijfroute aan de aanbiederkant via `supplierAuth`, eigenaar blijft `kern/care` (`care/opslag.js`).
- Regels en rekenwijze: behandeling, duur, prijs, behandelaar en tijden; een slot met een betaalde boeking kan niet worden weggehaald zonder die boeking te annuleren (met terugbetaling, ZRG-03).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: leden met een geraakte afspraak krijgen bericht.
- Rollen en toestemming: zaakbeheerder; medische behandelingen alleen in een bewijsgenre (ZRG-09).
- Uitzonderingen: prijswijziging raakt bestaande boekingen niet.
- Acceptatiecriterium: Gegeven de zorgbalie van Zenith, wanneer de beheerder een tijdslot 17:00 toevoegt, dan kan een lid direct op 17:00 boeken, en een wijziging van de prijs verandert het bedrag van een al betaalde boeking niet.

**ZRG-14 Annuleringsvoorwaarden per aanbieder** · L3 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: per aanbieder: kosteloos tot X uur vooraf, daarna percentage.
- Regels en rekenwijze: voorwaarde wordt op de boeking vastgezet bij betalen (zoals de pakketverdeling), zodat een latere wijziging niet terugwerkt.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid ziet de voorwaarde vóór betalen en bij annuleren wat er terugkomt.
- Rollen en toestemming: aanbieder zet, lid bevestigt door te betalen.
- Uitzonderingen: geen voorwaarde opgegeven → volledig terug tot het begin van de afspraak (de voorzichtige standaard voor het lid).
- Acceptatiecriterium: Gegeven een voorwaarde "kosteloos tot 24 uur", wanneer het lid 30 uur vooraf annuleert, dan krijgt hij alles terug, en 2 uur vooraf het bedrag uit de voorwaarde.

**ZRG-15 Eerstvolgend vrij moment (feit, geen voorspelling)** · L4 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: catalogustijden en `careBoekingen`.
- Regels en rekenwijze: de eerste datum+tijd zonder botsing, berekend uit de agenda; geen drukteverwachting.
- Onzekerheid: kan binnen seconden bezet raken; de boekknop blijft de waarheid (409).
- Wie hoort wat, wanneer: lid bij het aanbod.
- Rollen en toestemming: iedereen met de tab.
- Uitzonderingen: geen vrij moment in 30 dagen → "geen vrij moment gevonden; zet u op de wachtlijst".
- Acceptatiecriterium: Gegeven drie bezette slots op dag 1 en een vrij slot op dag 2, wanneer het lid het aanbod opent, dan staat dag 2 met dat tijdstip als eerstvolgend.

**ZRG-16 Voorbereidingsvragen per behandelingssoort, zonder oordeel** · L4 · ontbreekt · kosten klein · complexiteit laag · aanbevolen later
- Gegevens en bron: een vaste, door de aanbieder opgegeven lijst ("neem uw medicatieoverzicht mee", "eet niet zwaar vooraf"); geen model.
- Regels en rekenwijze: tonen, niet interpreteren; antwoorden gaan alleen via de intake (ZRG-04).
- Onzekerheid: geen; het is de tekst van de aanbieder.
- Wie hoort wat, wanneer: lid na boeken.
- Rollen en toestemming: aanbieder vult.
- Uitzonderingen: geen lijst → niets tonen.
- Acceptatiecriterium: Gegeven een aanbieder met twee voorbereidingspunten, wanneer het lid boekt, dan ziet hij precies die twee punten, en niets van RTG zelf.

**ZRG-17 AI-triage, symptoomchecker of urgentie-inschatting** · L4 · niet doen
- Reden: diagnose en triage zijn klinisch werk dat RTG niet doet (`kern/zorgniveau.js` niveau 3, brief: "de techniek beveelt een mens aan"); bij twijfel staan huisarts, huisartsenpost en 112 er.

**ZRG-18 Beoordelingen of no-show-score op een lid of behandelaar** · L4 · niet doen
- Reden: een cijfer op een mens (FOUNDATION 5.4) en een "strafblad met een vriendelijke naam" (`care/wachtlijst.js`); sterren op een zorgverlener zijn een zorgscore op een mens.

**ZRG-19 Nazorg na afronden** · L5 · ontbreekt · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: na `careAfronden` kan de behandelaar een nazorgtekst meegeven aan het lid (versleuteld, met `intakesleutel` en rij `nazorg|<boeking>`), en een "controle over N weken" als voorstel.
- Regels en rekenwijze: een voorstel opent een vooringevulde boeking; het lid bevestigt (geen automatische boeking).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid direct na afronden.
- Rollen en toestemming: behandelaar schrijft via de afspraakreferentie; geen tweede toestemming nodig, want het gaat naar het lid en niet in zijn dossier.
- Uitzonderingen: wellness: optioneel ("drink voldoende water").
- Acceptatiecriterium: Gegeven een afgeronde fysiosessie met nazorg "oefening X, controle over 2 weken", wanneer het lid zijn afspraak opent, dan ziet hij de tekst en een knop die een boeking over 2 weken vooraf invult maar niet maakt.

**ZRG-20 Betaalbewijs per afspraak (voor de verzekeraar of de eigen administratie)** · L5 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: boeking (aanbieder, behandeling, datum, bedrag), RTG Pay-boeking (`bk.betaling.boeking`).
- Regels en rekenwijze: alleen wat er is betaald; geen declaratiecode die wij niet hebben. Fiscale vraag (aftrek zorgkosten) krijgt klasse `advies` of `uitlegbaar` uit `kern/fiscaal/zekerheid.js`, nooit `bepaald`.
- Onzekerheid: of een verzekeraar vergoedt weet RTG niet en zegt dat.
- Wie hoort wat, wanneer: lid op verzoek.
- Rollen en toestemming: lid.
- Uitzonderingen: pakket: twee regels, behandeling en verblijf apart.
- Acceptatiecriterium: Gegeven een betaalde afspraak, wanneer het lid het betaalbewijs opent, dan staan aanbieder, behandeling, datum en bedrag erop en geen enkele bewering over vergoeding.

**ZRG-21 Afspraak in Agenda, tijdlijn en Leven** · L6 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `careMijn` wordt al gelezen door `kern/tijdlijn.js`, `kern/dagcoach.js`, `kern/life.js`; de agenda (`agenda.afspraken`, `apps/agenda.html`) is niet als bron vastgesteld.
- Regels en rekenwijze: projectie, geen kopie: de agenda toont de afspraak via verwijzing (`ref`) en opent de tab om te annuleren.
- Onzekerheid: of `apps/agenda.html` Care al leest heb ik niet vastgesteld.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: alleen het lid; een gezondheidsknoop draagt `deel: 'lid'` (`kern/levensgraaf/bronnen2.js`).
- Uitzonderingen: concierge of Rechterhand zien geen zorgafspraak (levensgraaf sluit het af).
- Acceptatiecriterium: Gegeven een betaalde Care-afspraak, wanneer het lid zijn agenda opent, dan staat de afspraak er met een knop naar de zorgtab, en een Rechterhand ziet hem niet.

**ZRG-22 Toestemmingen in RTG iD en de levensgraaf** · L6 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `kern/consent.js` (intrekken via `care-intake`), `kern/levensgraaf/bronnen-toestemming.js` (besloten, `deel: 'lid'`).
- Regels en rekenwijze: één intrekpad, de kern van Care.
- Onzekerheid: of de vastlegtoestemming ook in `consentVan` staat heb ik niet vastgesteld (de consentcode noemt alleen `care-intake`).
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: lid.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een actieve intake, wanneer het lid hem intrekt vanuit het toestemmingsoverzicht, dan is hij ook in de zorgtab gestopt.

**ZRG-23 Mantelzorger boekt namens, met een RTG iD-machtiging** · L6 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: machtiging per dienst, 1–90 dagen, herroepbaar (`kern/rtgid-regie.js`); de boeking blijft op de key van de zorgvrager.
- Regels en rekenwijze: de mantelzorger mag boeken en annuleren; de intake delen blijft een handeling van de zorgvrager zelf (art. 9, uitdrukkelijk); betalen van de wallet van de zorgvrager vraagt diens bevestiging, of de mantelzorger betaalt uit eigen wallet.
- Onzekerheid: wilsonbekwaamheid en wettelijke vertegenwoordiging vallen buiten wat een machtiging regelt.
- Wie hoort wat, wanneer: zorgvrager krijgt bericht van elke handeling namens hem.
- Rollen en toestemming: zorgvrager machtigt; mantelzorger handelt; spoor bij beide (staat al in `rtgid-regie.js`).
- Uitzonderingen: machtiging verlopen of ingetrokken → de lopende sessie stopt.
- Acceptatiecriterium: Gegeven een machtiging "zorg" van A aan B, wanneer B een afspraak voor A boekt, dan staat de afspraak bij A, krijgt A een melding, en kan B geen intake voor A delen.

**ZRG-24 Gesponsorde plaatsing van aanbieders** · L3 · niet doen
- Reden: zorg verkopen op wie het meest biedt, ondergraaft "de techniek beveelt een mens aan" en is een verslavings-/urgentiepatroon in de verkoop; het aanbod blijft neutraal geordend.

**ZRG-25 Videoconsult in de tab** · L5 · niet doen (nieuw domein vóór V1)
- Reden: een videoconsult is een nieuwe zorgvorm met eigen dossierplicht en techniek; zie Uitkomst B.

### e. RTG-exclusief

1. **Allergie reist van huis naar spa, zonder kopie in een tweede systeem.** Keten: het lid zet zijn zorgprofiel (eigenaar: zorgprofiel, `/api/zorgprofiel`, app-main-33) → Care neemt bij het boeken met toestemming een momentopname mee (`zorgMee`, eigenaar kern/care) → de behandelaar ziet hem in zijn dagagenda (eigenaar: zorgbalie, `leverancier-77.js`). Het lid trekt het zorgprofiel in, de volgende boeking draagt niets mee.
2. **Herstel na een reis.** Keten: een reis eindigt (eigenaar: RTG Reizen) → de pakketten van Care staan klaar als voorstel (eigenaar: kern/care) → het lid bevestigt en betaalt twee zaken via RTG Pay (eigenaar: RTG Pay) → het hotel ziet een gewone boeking (eigenaar: `verblijf.hotel`). Geen gedeelde data: de reis geeft alleen een datum door als verwijzing.
3. **Echt gemeten, met herkomst.** Keten: lid geeft vastlegtoestemming (kern/care) → behandelaar meet (zorgbalie) → de meting landt in de metingen van het lid met bron `behandelaar` en de naam van de zaak (`kern/metingen.js`) → Leven toont het als feit met herkomst (levensgraaf, besloten). Een andere app ziet alleen dat er een meting is.
4. **Rugdekking voor het lid.** Keten: Care-afspraak (kern/care) → betaling (RTG Pay) → het lid krijgt punten (`verdienPunten`) → RTG iD toont de toestemmingen (consent) → het lid trekt alles op één plek in. Bij geen enkele leider samen te vinden.
5. **Butler boekt in gewone taal, met dezelfde poort.** "Boek een hot stone morgen om 11:00" → voorstel → "ja" → `boekBehandelingActie` (exact `careBoek` + `careBetaal`) met de gelddrempel van het huis. Eigenaar van het gesprek: De Butler; eigenaar van de boeking: kern/care.

### f. Bouwstenen en ontbrekende koppelingen

Staat er:
- `server/kern/care.js`, `server/kern/care/{leden,zaak,pakketbetaal,intakesleutel,wachtlijst,vastleggen,opslag}.js`
- `server/kern/pay/zaakbetaling.js` (`betaalZaak`, `terugZaak`)
- `server/routes/member/persoonlijk-care.js`, `server/routes/supplier/care.js`
- `server/kern/consent.js`, `kern/tijdlijn.js`, `kern/dagcoach.js`, `kern/life.js`, `kern/zelfzorg/opruimen.js` (lezers)
- `server/kern/persoonseis.js`, `persoonseis-lijst.js`, `kern/aanmeldingen/bewijs.js`, `seed/genres-lijst-a.js`
- `scripts/lib/voltooi/tabzorg.js`, tests `care*.test.js`

Ontbreekt, per koppeling:

| koppeling | van → naar | vorm |
|---|---|---|
| terugbetalen bij annuleren | kern/care → RTG Pay (`terugZaak`) | aanroep met idem-sleutel; geen gedeelde data |
| bewijsstand van de aanbieder | genre-register/bewijs → kern/care (aanbod filteren) | verwijzing: `supplierCode` → `bewijsKlaar` |
| afspraak in de agenda | kern/care → Agenda (`agenda.afspraken`) | projectie op `ref` |
| herinnering | kern/care → berichten (`notify`) | bestaande meldingslaag |
| mantelzorg namens | RTG iD (`identiteit.rtgid-diensten`) → kern/care | machtiging als poort; boeking blijft op de key van de zorgvrager |
| deeplink vanuit Foundation | `apps/foundation/zorg.html` → `apps/app.html#tab=zorg` | adres; nu fout (`#zorg`), zie app 13 |
| wachtlijst, vastleggen, niet-verschenen op het scherm | API → app-main-13/14, `leverancier-77.js` | schermwerk |
| aanbiederbeheer | zorgbalie → `careAanbieders` | schrijfroute in de eigen kern |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| ZRG-03 terugbetalen | nu | klein | midden | ZRG-14; `terugZaak` (bestaat) |
| ZRG-09 medisch alleen bij bewijsgenre | nu | middel | midden | seedwijziging Clara; eigenaarsbesluit 6 (bestaande genres) |
| ZRG-14 annuleringsvoorwaarden | nu | klein | laag | ZRG-13 |
| ZRG-13 aanbiederbeheer | nu | middel | midden | ZRG-09 |
| ZRG-05 vastlegtoestemming scherm | nu | klein | laag | — |
| ZRG-06 wachtlijst scherm | nu | klein | laag | — |
| ZRG-10 zorgbalie compleet | nu | klein | laag | ZRG-05 |
| ZRG-08 herinnering | nu | klein | laag | — |
| ZRG-12 klachtroute Wkkgz | nu | klein | laag | ZRG-13 (aanbieder vult) |
| ZRG-15 eerstvolgend vrij | nu | klein | laag | — |
| ZRG-20 betaalbewijs | nu | klein | laag | fiscale klasse (`zekerheid.js`) |
| ZRG-21 agenda-projectie | nu | klein | laag | eigenaar Agenda |
| ZRG-01/02/04/07/22 | onderhoud | klein | laag | — |
| ZRG-11 persoonseis bij vastleggen | later | klein | midden | persoonlijke zaakinlog (`zaak.teamroom`) |
| ZRG-16 voorbereidingsvragen | later | klein | laag | ZRG-13 |
| ZRG-19 nazorg | later | klein | midden | ZRG-13 |
| ZRG-23 mantelzorger namens | later | middel | hoog | RTG iD; eigenaarsbesluit over betalen namens |
| ZRG-17, ZRG-18, ZRG-24 | niet doen | — | — | huisregels |
| ZRG-25 videoconsult | niet doen (nieuw domein vóór V1) | — | — | eigenaarsbesluit 1 |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket "eerlijke zorgboeking": ZRG-03 + ZRG-14 (geld terug volgens een vooraf zichtbare voorwaarde), ZRG-09 + ZRG-12 (medisch alleen bij een aanbieder waarvan een mens van RTG de vergunning zag, met de klachtroute erbij), ZRG-13 + ZRG-10 + ZRG-05 (de aanbieder beheert zijn eigen aanbod en heeft de hele zorgbalie, het lid de tweede schakelaar), ZRG-06 + ZRG-08 + ZRG-15 (wachtlijst, herinnering en eerstvolgend vrij moment op het scherm), ZRG-20 + ZRG-21 (betaalbewijs en de afspraak in de agenda). Allemaal in de bestaande kern/care, RTG Pay, genre-register en meldingslaag; geen nieuwe motor.

Wat de gebruiker daarna kan dat hij nu niet kan: zijn geld terugkrijgen bij annuleren; vooraf weten tot wanneer dat kosteloos is; zien dat een kliniek in een gekeurd zorggenre staat en waar hij met een klacht heen kan; zich op een wachtlijst zetten en een herinnering instellen (de melding na een gemiste afspraak klopt dan); de behandelaar zelf laten vastleggen en dat weer uitzetten. De aanbieder kan zijn eigen tijden en prijzen zetten en een gemiste afspraak noteren zonder dat het lid een cijfer meekrijgt.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **neutrale zorgtoegang** voor het lid en zijn gezin, waar elke zorgverlener in een bewijsgenre zijn agenda aanbiedt, het lid met één toestemmingsmodel deelt wat hij wil, en elke stap die een tweede mens raakt één bevestiging is. Nieuwe professionele processen die RTG kan ondersteunen:

1. **Verwijzing huisarts → fysiotherapeut of specialist, met de afspraak erachter.** Wie: huisarts (genre `huisarts`, handeling `verwijzen` vraagt `big`), ontvanger in `fysiotherapie`/`specialist`. Proces: huisarts verwijst in de zorgketen (`kern/zorgketen`, bestaat aan de aanbiederkant) → het lid krijgt een verwijzing als referentie in Care → het lid kiest een ontvanger en boekt → de intake gaat alleen mee als het lid dat bevestigt. Nodig: een koppeling zorgketen → Care op referentie (**eigenaarsbesluit**: twee bestaande kernen verbinden), geen nieuwe handeling.
2. **Videoconsult.** Wie: huisarts, fysiotherapeut. Proces van boeken tot afronden met een beveiligde verbinding. Nodig: een nieuwe motor (**eigenaarsbesluit**, nieuw domein), dossierplicht ligt bij de aanbieder (WGBO), NEN 7510 bij de techniek (extern).
3. **PGO-koppeling (MedMij).** Wie: het lid haalt zijn eigen gegevens op uit het systeem van de aanbieder. Nodig: MedMij-deelname en label (extern), NEN 7510 (extern), een nieuwe koppeling (**eigenaarsbesluit**). RTG blijft dan geen dossierhouder.
4. **Thuiszorg en zorg aan huis.** Wie: zaken in het open genre `care` ("Zorg aan huis"); verpleegkundige handelingen vragen een registratie. Proces: indicatie (door wijkverpleging of gemeente, extern) → planning bij het lid thuis → afronden met rapportage aan het lid. Nodig: een nieuwe handeling in het persoonseis-register zodra een voorbehouden handeling door de software loopt (**eigenaarsbesluit**), Wkkgz-klachtroute verplicht.
5. **Declaratie aan de zorgverzekeraar namens het lid.** Wie: de aanbieder of het lid. Nodig: externe koppeling met verzekeraars, AGB-codes (extern); RTG dient niets zelfstandig in namens iemand (`voorbehouden`), dus alleen klaarzetten (**eigenaarsbesluit**).
6. **Mantelzorg als rol.** Wie: mantelzorger met machtiging (RTG iD). Proces: afspraken plannen, vervoer regelen (bestaande ritten), respijt boeken. Nodig: besluit over betalen namens en over wettelijke vertegenwoordiging (**eigenaarsbesluit**).
7. **Klachtenfunctionaris als dienst.** Wie: onafhankelijke klachtenfunctionarissen als aanbieder. Nodig: nieuw genre (**eigenaarsbesluit**, nieuw domein).

De huisregels blijven: geen triage door een model, geen cijfer op een lid of een behandelaar, bevestigen doet de mens, en de beschermingsdeur (huisarts, huisartsenpost, 112, 113) staat bij elke zorgstap open.

### Ketens LOS en SAMEN

**LOS.** Staan RTG Pay, het zorgprofiel, de wachtlijst en de agenda uit, dan blijft de kerntaak: aanbod zien, een slot kiezen en boeken. Wat het scherm dan eerlijk zegt: bij betalen "RTG Pay is niet aangesloten; er is niets afgeschreven" (503, staat in de code); de boeking blijft `wacht-op-betaling` en vervalt na 30 minuten. Zonder zorgprofiel gaat er niets mee (`zorgMee` geeft niets). Zonder intakesleutel: "Uw medische context kan nu niet veilig worden bewaard. Er is niets gedeeld" (503). Een wachtlijst die niet kan seinen houdt geen annulering tegen.

**SAMEN — keten "fysio na een val, met de allergie erbij".**
1. Het lid zet zijn notenallergie in zijn zorgprofiel (eigenaar: zorgprofiel, app-main-33).
2. Hij opent de zorgtab vanuit Foundation Hulp & Zorg (eigenaar: `rtf.hulp-zorg`) via `#tab=zorg` (eigenaar: `kern.app`).
3. Hij kiest Fysiotherapie bij Clara en een slot (eigenaar: kern/care).
4. Hij deelt apart "bloedverdunner" met alleen Clara, 90 dagen (eigenaar: kern/care, paspoortdeur: `identiteit.verificatie`).
5. Hij betaalt (eigenaar: RTG Pay, `betalen.rtgpay`).
6. De afspraak verschijnt in zijn agenda (eigenaar: `agenda.afspraken`; nu niet vastgesteld).
7. Clara ziet in haar dagagenda de allergie en de intake (eigenaar: zorgbalie, `zaak.teamroom`/`leverancier-77.js`).
8. De fysiotherapeut legt met toestemming een meting vast (eigenaar: kern/care → `kern/metingen.js`).
9. Afronden; het lid krijgt een melding (eigenaar: kern/care).

Storingen:
- Schakel 2 valt uit (deeplink fout, zoals nu met `#zorg`): het lid landt op het beginscherm. Hij ziet geen fout, alleen de verkeerde stand; dat is precies waarom FZG-08 nu moet.
- Schakel 4 valt uit (geen gekeurd paspoort): de paspoortdeur weigert met zijn eigen zin; boeken gaat door zonder intake.
- Schakel 5 valt uit (bijlading geweigerd): 402, afspraak blijft `wacht-op-betaling`, niets afgeschreven (bewezen in `foundationzorg.js`).
- Schakel 6 valt uit: de afspraak staat in de zorgtab en de tijdlijn; de agenda zegt niets. Geen dubbele invoer.
- Schakel 7 valt uit (zorgbalie offline): de boeking bestaat; de behandelaar ziet de context pas als het scherm terug is. Het lid merkt niets.
- Schakel 8: zonder vastlegtoestemming 403 aan de balie met de zin "Vraag het bij de afspraak; het lid zet het zelf aan".

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | alle functies met stand "nu" uit d. bestaan, elk met een scherm (geen API zonder knop) | grep op `public/` per route uit `persoonlijk-care.js` en `supplier/care.js`: elke route heeft een aanroeper |
| professionele diepte | geen medische behandeling boekbaar bij een aanbieder buiten een bewijsgenre of met verlopen bewijs | toets: aanbieder type `zorg` + `soort: 'medisch'` → niet in `/api/care`; verlopen bewijs → weg |
| levenscyclus | voor (herinnering), tijdens (agenda), na (nazorg, betaalbewijs, terugbetaling) zijn alle drie gesloten | voltooiproef uitgebreid met annuleren → terugregel in RTG Pay; herinnering één melding |
| samenwerking en rollen | lid, behandelaar, balie en mantelzorger hebben elk precies hun eigen handelingen | kruisproef: balie zonder persoon legt niets vast; mantelzorger deelt geen intake |
| domeinintelligentie | er is geen enkele triage-, score- of rangschikkingsuitkomst over een mens | grep/toets: geen veld `score`, `rating`, `noShow` per lid in care-collecties; `careGemist` blijft per aanbieder |
| los functioneren | zonder RTG Pay, zorgprofiel, wachtlijst en agenda blijft boeken mogelijk en zegt elk scherm wat er uitstaat | voltooiproef met elke afhankelijkheid uit; geen 500, wel de vaste zin |
| RTG-ketens | de keten uit "SAMEN" loopt van Foundation tot afronden zonder handmatige tussenstap | e2e: deeplink `#tab=zorg` opent de zorgtab; agenda toont `ref` |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN, inclusief bereikbaar/bedienbaar via `#tab=zorg` en BEVOEGD met een eigen adres | APPWERKT.json na een nieuwe meting; BEVOEGD.json niet langer NIET_GETEST |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | geen dubbele logica: de zorgtab doet alleen |
|---|---|---|
| betalen, terugbetalen, saldo | `betalen.rtgpay` → `apps/pay.html` | `betaalZaak`/`terugZaak` aanroepen; geen eigen saldo |
| de afspraak in de agenda | `agenda.afspraken` → `apps/agenda.html` | `ref` als verwijzing aanbieden |
| herinneringen en berichten | `comm.berichten` → `apps/comm.html` | `notify` aanroepen |
| medicijnlijst van het lid | `gezondheid.medicatie` → `apps/medicijnen.html` | verwijzen ("neem uw medicatieoverzicht mee"); geen eigen lijst |
| paspoortkeuring voor de intake | `identiteit.verificatie` → `apps/verificatie.html` | de paspoortdeur vragen |
| mantelzorgmachtiging | `identiteit.rtgid-diensten` → `apps/rtgid.html` | de machtiging lezen als poort |
| hotelverblijf in een pakket | `verblijf.hotel` → `apps/hotels.html` | hotelcode en nachtprijs lezen |
| de werkplek van de behandelaar | `zaak.teamroom` → `apps/personeel.html` (zorgbalie is alias) | de zorgroutes leveren; geen tweede balie |
| het zorgaanbod als capability zelf | `kern.app` → `apps/app.html` | twijfel: aan de integrator voorleggen (er is geen eigen capability voor Care in SCHERMEIGENAAR.json) |
| Wmo-ondersteuning, maatwerk, respijt | `overheid.gemeente-burger` → `apps/gemeente.html` | verwijzen; Care boekt geen Wmo-zorg |

---


---

## 13. Foundation-zorg — `link:foundationzorg`, `/apps/foundation/zorg.html`

Hulp & Zorg is het rustige zorgscherm van FoundationOS voor gezinnen: het brengt twee gescheiden bronnen samen zonder ze te mengen. Uit RTG Care komen de eigen zorgafspraken van het lid (betalen, annuleren) en de lopende medische delingen; uit de Foundation komt de gezondheidskaart van het gezin (wie wanneer naar de dokter moet). Daarnaast een hulpwijzer die meedenkt over een veilige eerste stap zonder de tekst te bewaren, en de weg naar de veilige wegwijzer en 112. Voor wie: ouders en verzorgers, gezinnen met weinig ruimte, mantelzorgers in het gezin. De kern: zien wat eraan komt, wie helpt en wat je zelf deelt; nooit een zorgverlener, afspraak of toestemming verzinnen (`test/foundation-hulp-zorg.test.js`). Het scherm is eigenaar van `rtf.hulp-zorg` en leest voor de rest; de gezondheidskaart zelf is van `rtf.gezondheidsmaatje` (`apps/foundation/gezondheid.html`).

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | BEWEZEN | — | eigen adres `/apps/foundation/zorg.html` |
| bedienbaar | BEWEZEN | — | |
| menselijk | NIET_GETEST | 3 stappen afgeleid | |
| voltooibaar | GEEN_FIXTURE | sluit, 9 stappen | aanbod zien; boeken+betalen (één zorgregel, saldo daalt met prijs × 100); geweigerde bijlading reproduceerbaar → 402, niets af; annuleren met slot vrij; toestemming art. 9 → doktersafspraak op de kaart van het kind → volgende; hulpwijzer antwoordt en bewaart de vraag niet; drie bevoegdheidsstappen |
| waarheidsgetrouw | BEWEZEN | — | |
| persistent | GEEN_FIXTURE | sluit, 3 stappen | afspraak en doktersafspraak na herstart; doktersafspraak nergens leesbaar in de opslag maar via de kaart terug; nieuwe sessie |
| bevoegd | BEWEZEN | (in voltooibaar) | BEVOEGD.json 4/5 kruisparen; IDOR: zie care (11 gescheiden, 6 publiek) |
| herstelbaar | GEEN_FIXTURE | sluit, 4 stappen | dubbele tik betalen/annuleren één keer; afgebroken betaling; SIGKILL |

Wat de code doet (gelezen):

- **Scherm** `public/apps/foundation/zorg.html` met drie standen (`overzicht`, `hulp`, `begeleider`), `zorg-hulp.js` (laden, navigeren, betalen/annuleren via `/api/care/betaal|annuleer` met de ledentoken uit `localStorage`, hulpvraag naar `/api/foundation/hulp/ai` met gezinscode en -token) en `zorg-hulp-weergave.js` (alles ontsmet; samenvoegen van Care-afspraken en kaartafspraken tot max. vier, gesorteerd; "begeleider" = behandelaar van de eerstvolgende Care-afspraak; vier stappen aangevraagd/betaald/zorgmoment/afgerond; delingen alleen lezen; detailvenster).
- **Gezondheidskaart** `server/foundation/gasten/gezondheid.js`: per gezinslid medicijnen (afvinken per dag), medische afspraken, groeicurve; vrije tekst versleuteld (`encS`); lezen zonder scheppen (`kijk`); een ouder of beheerder beheert de kaart van een gezinslid, een kind niet die van een ouder (`magBeheren`); gasten hebben geen kaart; route `GET /api/foundation/gezin/:code/gezondheid`.
- **Toestemming art. 9** `server/foundation/gezondheidstoestemming.js` (eigenaarsbesluit 5 oktober 2026, DPIA-GEZIN.md): apart, bij het eerste gebruik; alleen ouder of beheerder; intrekken WIST alles (bevestig `WIS`), inclusief het gevoelsdagboek van wie jonger is dan 16 (`ouderGeeftToestemming`).
- **Oppasinfo en wissen** `server/foundation/zorg.js`: allergie in de oppasinfo vraagt dezelfde toestemming; recht om vergeten te worden met vier-ogen-regel bij twee volwassenen; bewaartermijn via `gezinbewaren.js`.
- **Hulpwijzer** `server/foundation/buddy.js` route `/hulp/ai`: `familieVan` (gezinsprofiel), soorten uit `buddy/coachdata/prompts.js`, max 10 berichten van 1500 tekens, zonder model of bij een fout de vaste tekst uit `demo.js`; het model loopt via de lokaal-eerst laag van `server/ai.js` (`RTG_EXTERNE_AI_UIT`, `LOCAL_AI_URL`). Er wordt niets bewaard (bewezen in de voltooiproef).
- **Poorten**: `/api/foundation/hulp/ai` staat in `BESCHERMDE_ROUTES` van `server/middleware/foundation-productiepoort.js` en als `OBJECT_SCOPED` in `server/kern/handlerpoorten/buiten-routes-b.js`.
- **Tests**: `test/foundation-hulp-zorg.test.js`, `test/gezondheidskaart.test.js`, `test/gezondheidstoestemming.test.js` en `.e2e.js`, `test/gezinzorg.test.js`.

Bevindingen bij het lezen:
1. **De knop "Nieuwe afspraak" en "Beheer medische delingen in RTG Care" wijzen naar `/apps/app.html#zorg`.** De app kent alleen `#tab=<stand>` of `#ai` (`app-main-12a.js`, regex `^#(?:tab=([a-z]+)|(ai))$`). `#zorg` matcht niet; het lid landt op het beginscherm. **Gerepareerd op 19 oktober (b0094e9d): nu `#tab=zorg`, met toets `test/foundation-applinks.test.js`.**
2. **De hulpwijzer gaat niet door de code-grens `kern/zorgniveau.js`.** `buddy.js` roept `niveauVan` niet aan; de grens rust op de systeemprompt. Het scherm stuurt "Zorg thuis" als soort `hulp`; die prompt (`prompts.js`, "Meike") noemt huisarts en 113 maar zegt niet "geen diagnose"; alleen de soort `gezondheid` doet dat. `zorgniveau.js` zegt zelf: "DE GRENS IS CODE EN GEEN PROMPT." **Gerepareerd op 19 oktober (b0094e9d): `buddy.js` roept `niveauVan` aan; crisis in elke soort, medicatie en diagnose in de zorgsoorten (hulp, gezondheid, baby, steun, gevoel). Toets `test/hulpwijzer-grens.test.js`.**
3. **De kaart kent geen leeftijdsgrens.** Een ouder beheert de kaart van elk gezinslid ongeacht leeftijd (`magBeheren`), terwijl het welzijnsdagboek wél op 16 jaar knipt (`ouderGeeftToestemming`).
4. **Twee medicijnlijsten.** De gezinskaart (`gasten/gezondheid.js`) en het medicatieschema van het lid (`kern/medicatie.js`, `apps/medicijnen.html`) bestaan naast elkaar; Hulp & Zorg linkt naar de tweede. SCHERMEIGENAAR geeft ze verschillende eigenaren en doelgroepen (`rtf.gezondheidsmaatje` voor het gezin, `gezondheid.medicatie` voor het lid); dubbel in doel is het niet, maar de grens hoort op het scherm te staan.
5. **"Begeleider" is de behandelaar van de eerstvolgende Care-afspraak**, geen vaste begeleider. De tekst "Verbonden aan uw volgende afspraak" zegt dat eerlijk.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| MyChart (Epic, patiëntportaal VS) | per zorginstelling; duurste: geen gegevens | geen gegevens | afspraken boeken/verzetten/annuleren, beveiligde berichten aan het zorgteam, proxy-toegang voor ouders en mantelzorgers, tieners vanaf 13 beperkte proxy, proxy stopt bij 18, uitslagen, herhaalrecepten, rekeningen | MyChart — https://www.mychart.org/ (zoekresultaat 2026-10-19, pagina niet geopend); MarinHealth — https://www.mymarinhealth.org/MyChart/ (zoekresultaat 2026-10-19, pagina niet geopend); Methodist — https://methodisthospitals.org/?p=79913 (zoekresultaat 2026-10-19, pagina niet geopend); Essentia — https://www.essentiamychart.org/MyChart/MyChartFeaturesandFunctions.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |
| Medisafe (medicatie) | gratis kern; Premium (duurste) | Premium $4,99/mnd of $39,99/jaar; buiten de VS sinds 1 januari 2026 alleen betaald | herinneringen, Medfriend (naaste krijgt bericht bij een gemiste dosis), onbeperkt gezinsprofielen, 20+ gezondheidsmetingen | Medisafe features — https://medisafeapp.com/features/ (zoekresultaat 2026-10-19, pagina niet geopend); Medisafe help — https://help-center.medisafe.com/en/articles/8102601-what-is-included-in-medisafe-premium (zoekresultaat 2026-10-19, pagina niet geopend); Medisafe help — https://help-center.medisafe.com/en/articles/13052285-medisafe-is-now-a-fully-paid-app-for-users-outside-the-u-s (zoekresultaat 2026-10-19, pagina niet geopend) |
| CarenZorgt / Caren (NL, cliëntportaal) | gratis voor betrokkenen; duurste: geen gegevens | gratis (Raphaëlstichting) | dossierinzage, de cliënt kiest wie meekijkt, eerste koppelaar wordt beheerder, mantelzorgers met rechten, gedeelde agenda, berichten voor praktische afstemming | Raphaëlstichting — https://www.raphaelstichting.nl/wp-content/uploads/2020/03/Carenzorgt-webversie.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Zorggroep Sint Maarten — https://www.zorggroepsintmaarten.nl/wp-content/uploads/2025/12/Leaflet-Caren-3.0.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Amarant — https://acceptatie.amarant.nl/uploads/media/642691b7038b9/handleiding-caren-voor-clienten-en-verwanten.pdf (zoekresultaat 2026-10-19, pagina niet geopend) |
| PGO's met MedMij-label (NL) | label per leverancier | geen gegevens | gegevens ophalen bij zorgaanbieders volgens het afsprakenstelsel, NEN 7510 | Kiwa — https://www.kiwa.com/nl/nl/diensten/certificering/medmij-keurmerk-voor-persoonlijke-gezondheidsomgevingen/ (zoekresultaat 2026-10-19, pagina niet geopend); Computable — https://www.computable.nl/artikel/achtergrond/zorg/6815305/1444691/welkom-in-de-wereld-van-de-medmij-labels.html (zoekresultaat 2026-10-19, pagina niet geopend) |

Welke kernfuncties wij hebben:

| kernfunctie | wij |
|---|---|
| alle afspraken van het gezin in één overzicht | ja (Care + kaart, max vier) |
| afspraak betalen/annuleren vanuit het overzicht | ja (Care) |
| ouder beheert kaart van het kind | ja |
| leeftijdsgrens 12/16/18 op de kaart | nee (alleen dagboek <16) |
| naaste krijgt bericht bij gemiste medicatie (Medfriend) | nee |
| zien wie meekijkt en toestemming intrekken | half (lezen ja; intrekken via de Care-tab) |
| berichten aan de zorgverlener | nee (bewust: zie FZG-21) |
| dossierinzage bij de zorgverlener | nee (Uitkomst B, PGO) |
| hulpwijzer naar gratis voorzieningen | ja, zonder opslag |
| veilige wegwijzer en 112 | ja |

### c. Het volledige domein

**Particulier en gezin.** Een gezin houdt bij: afspraken (huisarts, tandarts, consultatiebureau, kinderarts), medicijnen van een kind (wie gaf het al?), allergieën voor de oppas, groei. Ouders willen dat de ander het ziet, de oppas alleen wat nodig is, en het kind niet de kaart van de ouder kan wissen. Wie het zwaar heeft, zoekt eerst de weg: welke gratis voorziening, welk loket.

**Leeftijd en vertegenwoordiging (WGBO).** Voor kinderen van 12 tot 16 is voor behandeling de toestemming van het kind én de ouders nodig; vanaf 16 beslist de jongere zelf en mogen ouders het dossier alleen met zijn akkoord inzien. Voor inzage door ouders tussen 12 en 16 spreken de bronnen elkaar tegen. Bron: Maasstad Ziekenhuis — https://www.Maasstadziekenhuis.nl/media/16320/02340-nl-rechten-van-minderjarige-patiënten.pdf (zoekresultaat 2026-10-19, pagina niet geopend); VNG factsheet — https://vng.nl/sites/default/files/publicaties/2015/201412_factsheet_de_gegevens_van_uw_kind_vastgelegd_in_dossier.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Kamerstuk-bijlage — https://zoek.officielebekendmakingen.nl/blg-66958.pdf (zoekresultaat 2026-10-19, pagina niet geopend). De gezinskaart is geen WGBO-dossier (de ouder houdt hem zelf bij), maar wie de wet volgt, knipt op dezelfde leeftijden.

**Mantelzorg en Wmo 2015.** De gemeente is sinds 2015 verantwoordelijk voor mantelzorgondersteuning en respijtzorg; de Wmo 2015 verplicht tot passende ondersteuning, onderzocht in het keukentafelgesprek, en pas na eigen kracht, mantelzorg en algemene voorzieningen volgt een maatwerkvoorziening. Bron: gemeente Groningen — https://gemeenteraad.groningen.nl/Documenten/Document/Notitie-Mantelzorg-Ondersteuning-Notitie-Mantelzorg-Ondersteuning-1.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Binnenlands Bestuur — https://www.binnenlandsbestuur.nl/sociaal/wmo-en-mantelzorg/maatwerk-wmo-pakt-verkeerd-uit (zoekresultaat 2026-10-19, pagina niet geopend). Een invulformulier noemt art. 2.3.5 lid 3 Wmo 2015 voor overbelasting van de mantelzorger; dat is een commerciële formulierensite en geen wettekst — Forms Legal — https://forms-legal.com/netherlands/personal/legal-declarations/mantelzorg-indicatie (zoekresultaat 2026-10-19, pagina niet geopend). **Jeugdwet**: geen zoekresultaat gebruikt; alleen bij naam genoemd: jeugdhulp loopt via de gemeente, en de app verwijst ernaar.

**Medicatieveiligheid.** De kwaliteitsstandaard voor de overdracht van medicatiegegevens (Zorginstituut, 2020) en de rol van de patiënt als bron bij de verificatie van het actuele medicatieoverzicht. Bron: Zorginstituut Nederland — https://www.zorginstituutnederland.nl/binaries/zinl/documenten/magazine/2020/04/23/kwaliteitsstandaard-medicatieoverdracht-verbetert-patientveiligheid/Kwaliteitsstandaard+Medicatieoverdracht+verbetert+pati%C3%ABntveiligheid+-+Artikel+Zorginstituut+Magazine+april+2020.pdf (zoekresultaat 2026-10-19, pagina niet geopend); Skipr — https://skipr.nl/nieuws/richtlijn-medicatieoverdracht-aangescherpt (zoekresultaat 2026-10-19, pagina niet geopend). Het huis zegt hier al: "RTG BEPAALT NOOIT EEN DOSERING", geen interactiecheck (`kern/medicatie.js`).

**AVG art. 9**: zie app 12, onderdeel c (Legiscope). Het huis heeft de aparte toestemming bij eerste gebruik al gebouwd (DPIA-GEZIN.md wordt in de code genoemd; ik heb dat document niet gelezen).

**Wat daaruit volgt voor de app.**
1. De kaart volgt de WGBO-leeftijden: tot 12 beheert de ouder; 12–16 ziet het kind zijn eigen kaart en wordt een nieuwe medische afspraak van een ouder bij het kind gemeld; vanaf 16 is de kaart van de jongere zelf en ziet de ouder alleen wat de jongere deelt.
2. De hulpwijzer hoort achter dezelfde code-vloer als de rest van het huis (`zorgniveau.js`); bij klinische woorden geen model maar de wegen naar 113, huisarts en 112.
3. Mantelzorg en Wmo zijn verwijzingen naar de gemeente, nooit een aanvraag namens iemand (`voorbehouden`).
4. Medicatie: herinneren mag, adviseren nooit.

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk**: goed; het overzicht, betalen/annuleren, de hulpwijzer zonder opslag en de toestemming bestaan; de deeplink naar de zorgtab is stuk.
- **L2 Professioneel via bestaande genres**: dun en terecht; het scherm wijst de weg naar professionals (huisarts, consultatiebureau, wijkteam) maar mag geen professional nabootsen; de verwijzing naar het gemeenteloket ontbreekt.
- **L3 Organisatorisch**: half; rollen in het gezin (ouder, kind, gast) werken, de leeftijdsknip op de kaart ontbreekt.
- **L4 Domeinintelligentie**: de grens ligt nog in een prompt in plaats van in code; dat moet eerst.
- **L5 Volledige levenscyclus**: half; toestemming geven, intrekken en wissen bestaan; overdracht van de kaart aan een kind dat 16 of 18 wordt ontbreekt.
- **L6 RTG-samenhang**: half; Care en de kaart komen samen, maar de agenda, de mantelzorgmachtiging en de medicijnlijst van het lid zijn losse eilanden.

**FZG-01 Overzicht "uw volgende hulp"** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `/api/care/mijn` (Care), `/api/foundation/gezin/:code/gezondheid` (kaart).
- Regels en rekenwijze: alleen toekomstige afspraken, gesorteerd op datum+tijd, max vier; bron zichtbaar (Care opent detail, kaart opent `gezondheid.html`).
- Onzekerheid: geen; een bron die niet antwoordt wordt weggelaten.
- Wie hoort wat, wanneer: ouder bij openen.
- Rollen en toestemming: ledentoken voor Care, gezinssessie voor de kaart.
- Uitzonderingen: geen van beide → "Er staat nog geen zorg- of gezondheidsafspraak in uw verbonden omgevingen."
- Acceptatiecriterium: Gegeven een Care-afspraak over 10 dagen en een kinderartsafspraak over 5 dagen, wanneer de ouder het scherm opent, dan staat de kinderarts eerst en opent hij `gezondheid.html`.

**FZG-02 Betalen en annuleren vanuit het detail** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `/api/care/betaal|annuleer`.
- Regels en rekenwijze: identiek aan Care; bevestigingsvraag bij annuleren.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: alleen eigen afspraak (ander lid 404).
- Uitzonderingen: geweigerde bijlading → 402, "wacht-op-betaling", niets af (bewezen).
- Acceptatiecriterium: Gegeven een onbetaalde afspraak, wanneer de ouder in het detail "Nu betalen" kiest, dan is hij `geboekt` en daalt het saldo met precies de prijs.

**FZG-03 Hulpwijzer zonder opslag** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `/api/foundation/hulp/ai`, `buddy/coachdata`.
- Regels en rekenwijze: max 10 berichten, 1500 tekens; niets bewaard; zonder model de vaste tekst.
- Onzekerheid: een modelantwoord is een suggestie, geen hulpverlening.
- Wie hoort wat, wanneer: alleen de vrager.
- Rollen en toestemming: gezinsprofiel.
- Uitzonderingen: zonder profiel: "Kies eerst uw eigen Foundation-profiel."
- Acceptatiecriterium: Gegeven een hulpvraag met een unieke zin, wanneer de vraag is beantwoord, dan staat die zin nergens in de opslag.

**FZG-04 Begeleider en stappen van de volgende afspraak** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: eerstvolgende Care-afspraak.
- Regels en rekenwijze: "Afgerond" alleen na bevestiging door de zorgverlener (`status === 'afgerond'`).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: lid.
- Uitzonderingen: geen afspraak → lege tekst, geen verzonnen begeleider.
- Acceptatiecriterium: Gegeven een betaalde afspraak die de zorgbalie afrondt, wanneer de ouder "Begeleider" opent, dan staan alle vier stappen op klaar.

**FZG-05 Wie mag meekijken (alleen lezen)** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `intakes` uit `/api/care`.
- Regels en rekenwijze: alleen actieve, niet-verlopen delingen.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: lid.
- Uitzonderingen: niet ingelogd bij Care → "Log in bij RTG Care…".
- Acceptatiecriterium: Gegeven één actieve intake met Clara, wanneer de ouder het paneel opent, dan staat Clara er met de vervaldatum.

**FZG-06 Toestemming art. 9 voor het gezin, met WIS** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `g.toestemmingGezondheid`.
- Regels en rekenwijze: apart, bij eerste gebruik; zonder toestemming 409; intrekken wist kaart, allergie en dagboek <16.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: ouder; een kind krijgt "Vraag je ouder…".
- Rollen en toestemming: ouder of beheerder.
- Uitzonderingen: gegevens van vóór het besluit blijven leesbaar.
- Acceptatiecriterium: Gegeven geen toestemming, wanneer de ouder een afspraak op de kaart zet, dan krijgt hij 409, en na toestemming 200.

**FZG-07 Gezondheidskaart (lezen via Hulp & Zorg)** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `gasten/gezondheid.js`, versleuteld.
- Regels en rekenwijze: Hulp & Zorg leest alleen; schrijven in `gezondheid.html` (`rtf.gezondheidsmaatje`).
- Onzekerheid: wat de ouder invult, is zijn eigen aantekening.
- Wie hoort wat, wanneer: gezinsleden behalve gasten.
- Rollen en toestemming: ouder beheert; kind niet bij ouder (403).
- Uitzonderingen: gast → "Een gast heeft geen gezondheidskaart."
- Acceptatiecriterium: Gegeven een doktersafspraak op de kaart, wanneer een ander gezin met eigen token de kaart vraagt, dan krijgt het 401–403 en geen afspraaktekst.

**FZG-08 Deeplink naar de zorgtab herstellen** · L1 · bestaat (gerepareerd in b0094e9d) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `zorg.html` (twee links), `app-main-12a.js`.
- Regels en rekenwijze: `/apps/app.html#tab=zorg`.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: tab zichtbaar voor elk eigen account.
- Uitzonderingen: gast zonder account: tab verborgen → het beginscherm, met een zin waarom.
- Acceptatiecriterium: Gegeven een ingelogd lid, wanneer hij "Nieuwe afspraak" kiest, dan opent de app in de stand `zorg`.

**FZG-09 De hulpwijzer achter de code-vloer `zorgniveau.js`** · L4 · bestaat (gerepareerd in b0094e9d) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `kern/zorgniveau.js` (`niveauVan`, `KLINISCH`, `MEDISCH`, `HULP`).
- Regels en rekenwijze: elk gebruikersbericht gaat eerst door `niveauVan`; klinisch → geen modelaanroep, de vaste wegen (113, huisarts, 112); medisch → geen inhoud, wel de weg naar huisarts of apotheek; soort `hulp` krijgt dezelfde "geen diagnose"-zin als `gezondheid`.
- Onzekerheid: de woordenlijst mist dingen ("een vloer, geen filter"); daarom staat de spoedkaart er altijd.
- Wie hoort wat, wanneer: alleen de vrager, direct.
- Rollen en toestemming: geen extra.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven de vraag "welke dosis paracetamol voor mijn zoon", wanneer de ouder hem stelt, dan komt er geen modelantwoord maar de vaste tekst met huisarts en apotheek, en de vraag staat nergens in de opslag.

**FZG-10 Wegwijzer naar het eigen gemeenteloket (Wmo, Jeugdwet, mantelzorgsteun)** · L2 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de gemeente-app (`overheid.gemeente-burger`), de veilige wegwijzer (`hulp.wegwijzer`).
- Regels en rekenwijze: alleen verwijzen: "Voor ondersteuning thuis, jeugdhulp of steun als mantelzorger is uw gemeente het loket" + knop naar de gemeente-app; geen aanvraag namens iemand (`voorbehouden`).
- Onzekerheid: welke gemeente het is weet RTG alleen als het lid hem opgaf.
- Wie hoort wat, wanneer: de vrager.
- Rollen en toestemming: geen.
- Uitzonderingen: geen gemeente bekend → algemene uitleg.
- Acceptatiecriterium: Gegeven de soort "Zorg thuis", wanneer de ouder de pagina opent, dan ziet hij een knop naar het gemeenteloket en geen formulier dat iets indient.

**FZG-11 Leeftijdsknip op de kaart (12 / 16 / 18)** · L3 · ontbreekt · kosten middel · complexiteit midden · aanbevolen nu
- Gegevens en bron: `lib/leeftijd.js` (`leeftijdVan`, `ouderGeeftToestemming`), `magBeheren`.
- Regels en rekenwijze: <12 ouder beheert; 12–16 ouder beheert, kind ziet en krijgt bericht bij elke nieuwe medische regel; ≥16 alleen de jongere zelf, ouder ziet wat de jongere deelt. Onbekende leeftijd: rol `kind` telt als <16 (bestaande regel).
- Onzekerheid: de geboortedatum is opgegeven, niet gekeurd, tenzij RTG iD hem overnam (`leeftijdBron`).
- Wie hoort wat, wanneer: kind en ouder bij elke wijziging vanaf 12.
- Rollen en toestemming: ouder, kind, jongere.
- Uitzonderingen: de beschermingsdeur (HDI par. 7) blijft open: een jongere kan altijd zelf de wegwijzer openen.
- Acceptatiecriterium: Gegeven een gezinslid van 17, wanneer een ouder een afspraak op zijn kaart zet, dan weigert de server met een zin dat dit zijn eigen kaart is.

**FZG-12 Toestemming intrekken vanuit Hulp & Zorg** · L1 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `/api/care/intake/stop` (bestaat), nu alleen in de zorgtab.
- Regels en rekenwijze: stoppen naast elke deling, met dezelfde route; geen eigen logica.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: lid.
- Uitzonderingen: ander lid 404.
- Acceptatiecriterium: Gegeven een actieve deling, wanneer de ouder in "Wie mag meekijken" op stoppen tikt, dan verdwijnt hij hier en in de zorgtab.

**FZG-13 Medicijn gegeven: een naaste ziet het (zonder alarm)** · L1 · half · kosten klein · complexiteit laag · aanbevolen later
- Gegevens en bron: `medicijn/gegeven` op de gezinskaart (bestaat, met `door`).
- Regels en rekenwijze: de andere ouder ziet "gegeven door X om Y"; geen melding bij niet afgevinkt, geen teller (de regel uit `medicijnen.html`: "geen rood, geen uitroepteken").
- Onzekerheid: afgevinkt is een aantekening, geen bewijs van inname.
- Wie hoort wat, wanneer: ouders bij openen.
- Rollen en toestemming: ouders.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een afgevinkt medicijn, wanneer de tweede ouder de kaart opent, dan ziet hij wie het gaf, en er komt geen pushmelding bij niet afvinken.

**FZG-14 Percentiel- of groeinorm op de groeicurve** · L4 · niet doen
- Reden: een vergelijking met een norm is een medisch oordeel over een kind; dat doet het consultatiebureau.

**FZG-15 Medicatie-interactiecheck of doseeradvies** · L4 · niet doen
- Reden: `kern/medicatie.js` sluit het uitdrukkelijk uit ("een half werkende versie is gevaarlijker dan geen").

**FZG-16 Vaccinatie- of consultatiebureauschema als herinnering** · L4 · ontbreekt · kosten middel · complexiteit midden · aanbevolen later
- Gegevens en bron: alleen een uitnodiging die de ouder zelf invoert; geen eigen schema (het schema is extern en ik heb er geen bron voor).
- Regels en rekenwijze: herinneren aan wat de ouder invoerde; nooit "uw kind is te laat".
- Onzekerheid: RTG kent het schema niet en zegt dat.
- Wie hoort wat, wanneer: ouder.
- Rollen en toestemming: ouder, met de art. 9-toestemming.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een ingevoerde uitnodiging, wanneer de datum nadert, dan krijgt de ouder één herinnering en nooit een tekst over achterstand.

**FZG-17 Overdracht van de kaart bij 16 en 18** · L5 · ontbreekt · kosten middel · complexiteit hoog · aanbevolen later
- Gegevens en bron: de kaart van het kind; een eigen account vanaf de leeftijdsgrens.
- Regels en rekenwijze: bij 16 wordt de jongere eigenaar van zijn kaart (FZG-11); bij een eigen account kan hij hem meenemen als export of verwijzing; de ouder ziet daarna niets meer tenzij gedeeld.
- Onzekerheid: leeftijd opgegeven vs. gekeurd.
- Wie hoort wat, wanneer: jongere en ouder bij de overgang.
- Rollen en toestemming: jongere beslist.
- Uitzonderingen: wilsonbekwaamheid: buiten de app, verwijzen.
- Acceptatiecriterium: Gegeven een kind dat 16 wordt, wanneer de ouder daarna de kaart opent, dan ziet hij een melding dat de kaart nu van de jongere is.

**FZG-18 Wissen, bewaartermijn, vier ogen** · L5 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `foundation/zorg.js` (`wisGezin`, `gezinBewaren`), `gezondheidstoestemming.js`.
- Regels en rekenwijze: twee volwassenen → verzoek + bevestiging door de ander.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: beide volwassenen.
- Rollen en toestemming: ouder/beheerder met pincode.
- Uitzonderingen: één volwassene wist direct.
- Acceptatiecriterium: Gegeven twee ouders, wanneer de eerste wissen vraagt, dan blijft alles staan tot de tweede bevestigt.

**FZG-19 Eén grens tussen de twee medicijnlijsten** · L6 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `gasten/gezondheid.js` (gezin) en `kern/medicatie.js` (lid).
- Regels en rekenwijze: geen samenvoegen; de tegel "Medicijnen" in Hulp & Zorg zegt "uw eigen schema" en de gezinskaart "medicijnen van uw gezinsleden"; beide tonen het bordje uit `medicatie-regels.js` (`GRENS`).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: lid.
- Rollen en toestemming: zoals elk.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven het scherm, wanneer de ouder de medicijntegel ziet, dan staat erbij voor wie die lijst is, en op beide lijsten staat "RTG gaat niet over uw medicijnen".

**FZG-20 Gezondheidsafspraak in de gezinsagenda** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen later
- Gegevens en bron: gezinsagenda (`foundation/gasten/gezinsagenda.js`, agendamotor `gezin:<code>`).
- Regels en rekenwijze: projectie met alleen "afspraak" en de tijd, geen medische tekst, tenzij de ouder dat kiest.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: gezinsleden in de agenda.
- Rollen en toestemming: ouder kiest per afspraak; gast ziet niets medisch.
- Uitzonderingen: de jongere ≥16 beslist over zijn eigen afspraken (FZG-11).
- Acceptatiecriterium: Gegeven een kinderartsafspraak, wanneer de ouder "in de gezinsagenda" kiest, dan ziet de oppas "afspraak 09:30" zonder het woord kinderarts.

**FZG-21 Berichten aan de zorgverlener** · L2 · niet doen (nieuw domein vóór V1)
- Reden: een berichtenkanaal met een behandelaar maakt RTG onderdeel van het dossier en de zorgverlening; zie Uitkomst B.

**FZG-22 Mantelzorgoverzicht: voor wie zorg ik** · L6 · half · kosten klein · complexiteit midden · aanbevolen later
- Gegevens en bron: mantelzorgmachtigingen (`kern/rtgid-regie.js`), bijdrageknoop "mantelzorg" (`kern/levensgraaf/bronnen-leven-bijdrage.js`).
- Regels en rekenwijze: projectie: "u heeft een machtiging voor <codenaam>, dienst X, tot Y"; doorklikken naar de zorgtab namens (ZRG-23); nooit uren of zwaarte tellen (geen capaciteitscijfer op een mens).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: mantelzorger.
- Rollen en toestemming: alleen machtigingen naar mij.
- Uitzonderingen: ingetrokken → weg.
- Acceptatiecriterium: Gegeven een actieve machtiging, wanneer de mantelzorger Hulp & Zorg opent, dan ziet hij de zorgvrager en de einddatum, en geen getal over zijn eigen belasting.

**FZG-23 Hulpvraag doorzetten als bericht aan een eigen naaste** · L6 · ontbreekt · kosten klein · complexiteit laag · aanbevolen later
- Gegevens en bron: Berichten (`comm.berichten` of `rtf.bericht`).
- Regels en rekenwijze: de hulpwijzer stelt een concepttekst voor; het lid kiest de ontvanger en verstuurt zelf (één menselijke bevestiging); de hulpwijzer bewaart nog steeds niets.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gekozen naaste, na versturen.
- Rollen en toestemming: lid.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een antwoord van de hulpwijzer, wanneer het lid "vraag iemand uit mijn kring" kiest, dan opent Berichten met de tekst en is er nog niets verstuurd.

### e. RTG-exclusief

1. **Eén overzicht, twee eigenaars, nul kopieën.** Care-afspraken (kern/care) en gezinsafspraken (`rtf.gezondheidsmaatje`) staan samen op één scherm (`rtf.hulp-zorg`), terwijl elk in zijn eigen opslag blijft; Hulp & Zorg schrijft niets in de kaart en niets in Care.
2. **Van zorgen naar boeken naar betalen zonder overstap.** Hulpwijzer (Foundation) → verwijzing naar de zorgtab (`kern.app`) → boeken (kern/care) → betalen (RTG Pay) → terug in het overzicht van Hulp & Zorg.
3. **De beschermingsdeur in elk zorgscherm.** De spoedkaart verwijst naar de veilige wegwijzer (`hulp.wegwijzer`), zonder naam, en naar 112; geen andere leider combineert gezinszorg met een anonieme veiligheidsroute.
4. **Mantelzorg op identiteit.** RTG iD-machtiging (`identiteit.rtgid-diensten`) → zichtbaar in Hulp & Zorg (FZG-22) → handelen in de zorgtab (ZRG-23), met een spoor bij beide.
5. **Toestemming die wist.** Intrekken van de art. 9-toestemming wist werkelijk (inclusief dagboek <16), met vier ogen bij twee volwassenen; dat is strenger dan wat de leiders in de zoekresultaten noemen.

### f. Bouwstenen en ontbrekende koppelingen

Staat er:
- `public/apps/foundation/zorg.html`, `zorg-hulp.js`, `zorg-hulp-weergave.js`
- `server/foundation/gasten/gezondheid.js`, `server/foundation/gezondheidstoestemming.js`, `server/foundation/zorg.js`
- `server/foundation/buddy.js` en `buddy/coachdata/*`
- `server/kern/zorgniveau.js` (sinds b0094e9d aangesloten op `/hulp/ai`)
- `server/lib/leeftijd.js`
- `scripts/lib/voltooi/foundationzorg.js`, `test/foundation-hulp-zorg.test.js`

Ontbreekt, per koppeling:

| koppeling | van → naar | vorm |
|---|---|---|
| deeplink naar de zorgtab | `zorg.html` → `apps/app.html#tab=zorg` | adres |
| code-vloer voor de hulpwijzer | `buddy.js` → `kern/zorgniveau.js` | aanroep, geen nieuwe laag |
| intrekken van delingen | Hulp & Zorg → `/api/care/intake/stop` | bestaande route |
| gemeenteloket | Hulp & Zorg → `overheid.gemeente-burger` | verwijzing |
| mantelzorgoverzicht | RTG iD → Hulp & Zorg | projectie van machtigingen |
| gezinsagenda | gezondheidskaart → gezinsagenda | projectie zonder medische tekst |
| leeftijdsknip | `lib/leeftijd.js` → `gasten/gezondheid.js` | regel in `magBeheren` |

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| FZG-08 deeplink | nu | klein | laag | — |
| FZG-09 code-vloer hulpwijzer | nu | klein | laag | `zorgniveau.js` (bestaat) |
| FZG-11 leeftijdsknip | nu | middel | midden | eigenaarsbesluit over 12–16 (bronnen spreken elkaar tegen) |
| FZG-12 intrekken vanuit Hulp & Zorg | nu | klein | laag | — |
| FZG-10 gemeenteloket | nu | klein | laag | `overheid.gemeente-burger` |
| FZG-19 grens medicijnlijsten | nu | klein | laag | — |
| FZG-01..07, FZG-18 | onderhoud | klein | laag | — |
| FZG-13 gegeven zichtbaar | later | klein | laag | — |
| FZG-16 eigen uitnodiging als herinnering | later | middel | midden | — |
| FZG-17 overdracht 16/18 | later | middel | hoog | FZG-11; eigen account van de jongere |
| FZG-20 gezinsagenda | later | klein | laag | gezinsagenda |
| FZG-22 mantelzorgoverzicht | later | klein | midden | RTG iD; ZRG-23 |
| FZG-23 hulpvraag naar een naaste | later | klein | laag | Berichten |
| FZG-14, FZG-15 | niet doen | — | — | huisregels |
| FZG-21 berichten aan de zorgverlener | niet doen (nieuw domein vóór V1) | — | — | eigenaarsbesluit 1 |

### Uitkomst A — binnen de huidige architectuur en scope

Pakket "veilig en rond": FZG-08 (de knop naar de zorgtab werkt), FZG-09 (de hulpwijzer achter dezelfde code-vloer als de rest van het huis), FZG-11 (de kaart volgt de leeftijden 12/16), FZG-12 (een deling stoppen waar je hem ziet), FZG-10 (de weg naar het gemeenteloket voor Wmo, jeugdhulp en mantelzorgsteun) en FZG-19 (helder welke medicijnlijst van wie is). Alles met bestaande routes, `zorgniveau.js`, `lib/leeftijd.js` en verwijzingen.

Wat de gebruiker daarna kan dat hij nu niet kan: vanuit Hulp & Zorg in één tik in de zorgtab boeken; erop vertrouwen dat een vraag over dosering of een diagnose nooit een modelantwoord krijgt; als jongere van 16 zijn eigen kaart hebben; een medische deling stoppen zonder het scherm te verlaten; weten waar hij voor ondersteuning thuis heen moet.

### Uitkomst B — het domeinmaximum

Het eindproduct is een **gezinszorgomgeving** die de ouder, de jongere en de mantelzorger elk hun eigen deel geeft, gekoppeld aan echte zorgverleners zonder dat RTG zorgverlener wordt. Nieuwe professionele processen:

1. **PGO voor het gezin (MedMij).** Wie: het lid en, binnen de leeftijdsregels, de ouder. Proces: gegevens ophalen bij huisarts en apotheek, het medicatieoverzicht meenemen naar een afspraak. Nodig: MedMij-label en NEN 7510 (extern), een nieuwe koppeling (**eigenaarsbesluit**).
2. **Wijkteam of consultatiebureau als partner.** Wie: gemeentelijke teams en jeugdgezondheidszorg. Proces: het gezin deelt op eigen initiatief een afspraak of vraag; het team antwoordt via Berichten. Nodig: een rol voor publieke zorgpartners in een bestaand genre of een nieuw genre (**eigenaarsbesluit**); alleen geaggregeerd naar de gemeente (LEVEN 2.6).
3. **Wmo-aanvraag klaarzetten.** Wie: inwoner en mantelzorger. Proces: de app helpt het keukentafelgesprek voorbereiden (eigen woorden, wat wel en niet lukt), de inwoner neemt het zelf mee. Nodig: geen indiening namens iemand (`voorbehouden`); een koppeling met een gemeente zou een **eigenaarsbesluit** zijn.
4. **Berichten met de eigen zorgverlener.** Wie: huisarts/behandelaar in een bewijsgenre. Nodig: dossierplicht bij de zorgverlener (WGBO), Wkkgz-klachtroute, NEN 7510 (extern); **eigenaarsbesluit** (nieuw domein).
5. **Respijtzorg boeken.** Wie: mantelzorger, aanbieders in genre `care`. Proces: indicatie door de gemeente (extern), boeking via Care. Nodig: Wmo-indicatie als verwijzing, betaling door de gemeente (extern, **eigenaarsbesluit**).
6. **Medfriend-achtige steun zonder alarm.** Wie: een naaste. Proces: de naaste ziet "gegeven" en kan vragen of het lukt; nooit een teller. Nodig: niets extern; wel een besluit dat een naaste buiten het gezin dit mag zien (**eigenaarsbesluit**).

Huisregels blijven: geen diagnose of triage door een model, geen zorgscore of belastingcijfer op een mens, alleen geaggregeerd naar gemeenten, bevestigen doet de mens, de beschermingsdeur open.

### Ketens LOS en SAMEN

**LOS.** Staan Care, het model en de gezinssessie uit, dan blijft de kerntaak: de weg wijzen. Het scherm zegt dan eerlijk: zonder Care "Log in bij RTG Care om actieve medische delingen te controleren" en geen Care-afspraken; zonder gezinssessie geen kaart en "Kies eerst uw eigen Foundation-profiel"; zonder model de vaste hulptekst (`HULP_DEMO`); de spoedkaart (112, veilige wegwijzer) staat er altijd en heeft geen server nodig.

**SAMEN — keten "kind slaapt slecht, ouder zoekt hulp en boekt".**
1. De ouder stelt een vraag in de hulpwijzer (eigenaar: `rtf.hulp-zorg`; model via `server/ai.js`).
2. De code-vloer keurt het bericht (eigenaar: `kern/zorgniveau.js`; aangesloten sinds b0094e9d).
3. De hulpwijzer noemt huisarts en consultatiebureau; de ouder zet een afspraak op de kaart van het kind (eigenaar: `rtf.gezondheidsmaatje`) na de art. 9-toestemming (eigenaar: gezondheidstoestemming).
4. Hulp & Zorg toont hem als eerstvolgende (eigenaar: `rtf.hulp-zorg`).
5. Voor zichzelf boekt de ouder een massage via "Nieuwe afspraak" (eigenaar: `kern.app` → kern/care) en betaalt (RTG Pay).
6. De afspraak staat terug in Hulp & Zorg met de stappen.

Storingen:
- Schakel 1 (model) valt uit: vaste tekst; de ouder krijgt toch drie plekken.
- Schakel 2 ontbreekt (nu): een klinische vraag gaat naar het model met alleen een prompt als grens; na FZG-09 krijgt hij geen modelantwoord maar de wegen naar 113/huisarts/112.
- Schakel 3 zonder toestemming: 409 "Gezondheidsgegevens bewaren vraagt eerst uw aparte toestemming."
- Schakel 5 deeplink (nu stuk): beginscherm in plaats van zorgtab.
- Schakel 5 bijlading geweigerd: 402, niets af, afspraak blijft `wacht-op-betaling`, en Hulp & Zorg toont "Nog te betalen".

### h. Eindcontract Beyond Premium

| dimensie | toetsbaar criterium | hoe gemeten |
|---|---|---|
| breedte | elke functie "nu" uit d. heeft een werkende knop op Hulp & Zorg of een verwijzing | e2e over de drie standen; elke link opent het juiste adres (`#tab=zorg`) |
| professionele diepte | geen enkel antwoord van de hulpwijzer op een klinisch of medicatiebericht komt van een model | toets: berichten uit `KLINISCH` en `MEDISCH` → geen modelaanroep, vaste tekst |
| levenscyclus | toestemming geven, gebruiken, intrekken (wist), en overdracht bij 16 zijn alle gesloten | `gezondheidstoestemming.test.js` + nieuwe toets voor de leeftijdsknip |
| samenwerking en rollen | ouder, kind <16, jongere ≥16, gast en mantelzorger hebben elk hun eigen rechten op de kaart | kruisproef per rol, BEVOEGD 5/5 |
| domeinintelligentie | geen norm, percentiel, score of achterstandstekst op een kind of ouder | grep/toets op de antwoordvelden van de kaart |
| los functioneren | met Care, model en gezinssessie elk uit toont het scherm de vaste zin en blijft de spoedkaart werken | voltooiproef met elke bron uit |
| RTG-ketens | de keten uit "SAMEN" loopt zonder handmatige tussenstap | e2e hulpvraag → kaart → zorgtab → betaald → terug in het overzicht |
| bewezen betrouwbaarheid | alle acht APPWERKT-bewijzen BEWEZEN, menselijk inbegrepen, en BEVOEGD 5/5 | APPWERKT.json en BEVOEGD.json na een nieuwe meting |

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

| behoefte | eigenaar (SCHERMEIGENAAR.json) | geen dubbele logica: Hulp & Zorg doet alleen |
|---|---|---|
| zorg boeken en betalen | `kern.app` → `apps/app.html` (stand `zorg`) en `betalen.rtgpay` → `apps/pay.html` | tonen, betalen en annuleren via de Care-routes; geen eigen boekingslogica |
| de gezondheidskaart bijhouden | `rtf.gezondheidsmaatje` → `apps/foundation/gezondheid.html` | lezen en linken |
| eigen medicijnschema | `gezondheid.medicatie` → `apps/medicijnen.html` | linken |
| wie mag meekijken (banden) | `rtf.wie-mag-zien` → `apps/foundation/mijnbanden.html` | linken |
| hulpwijzer als eigen scherm | `rtf.hulpwijzer` → `apps/foundation/hulpwijzer.html` | twijfel: aan de integrator voorleggen (Hulp & Zorg heeft een eigen hulpvraagstand op dezelfde route) |
| veilige wegwijzer | `hulp.wegwijzer` → `apps/foundation/wegwijzer.html` | linken |
| steun bij zwaar gemoed | `gezondheid.steun` → `apps/foundation/steun.html` | linken |
| allergie voor de oppas | `gezin.oppasinfo` → `apps/foundation/oppasinfo.html` | niets; de kaart leest de allergie al uit oppasinfo |
| gemeenteloket (Wmo, Jeugdwet, mantelzorg) | `overheid.gemeente-burger` → `apps/gemeente.html` | verwijzen |
| mantelzorgmachtiging | `identiteit.rtgid-diensten` → `apps/rtgid.html` | projectie lezen |
| berichten aan een naaste | `comm.berichten` → `apps/comm.html` of `rtf.bericht` → `apps/foundation/mail.html` | twijfel: aan de integrator voorleggen (welke van de twee voor het gezin) |
| gezinsagenda | twijfel: aan de integrator voorleggen (geen eigen capability voor de gezinsagenda gevonden; `agenda.afspraken` is van het lid) | projectie aanbieden |
| welzijnsdagboek en gezondheid/welzijn | `rtf.gezondheid-welzijn` → `apps/foundation/gezondheid-welzijn.html` | linken |


---

## 14. RTF-tegel — `os:rtf` (kiezer in de app: leeftijdskeuze, daarna `/apps/foundation/index.html`)

De RTF-tegel is de ene ingang van een gezin naar FoundationOS. In de RTG-app opent `os:rtf` een kiezer met vijf leeftijdsgroepen: RTF Mini (0 t/m 4), Kids (5 t/m 11), Tiener (12 t/m 15), Jong (16 t/m 21+) en Volwassen (ouders en verzorgers). Een keuze opent `/apps/foundation/index.html?groep=…`, de deur (capability `rtf.start`). Daar logt de ouder in met zijn RTG-account (Mijn gezin), maakt hij het gezin, voegt hij een kind toe en opent hij per profiel een sessie op het toestel. Daarna ziet het profiel zijn dag, zijn ontwikkeling, zijn kring en de tegels die bij zijn leeftijd horen. Het is een opzet als een streamingdienst met profielen, met één verschil: een kind opent niets zonder dat RTG het paspoort van de ouder heeft gezien. De tegel bezit zelf geen gegevens van een app. De leeftijdskeuze is een bril en geen poort: het toegangsbesluit ligt bij de server (`/api/rtf/toegang` en de accountplicht).

### a. Bewezen bestaand

| bewijs | register (APPWERKT af81b538) | voltooiproef vandaag | opmerking |
|---|---|---|---|
| bereikbaar | NIET_GETEST | geen scenario | de tegel staat in LivingOS (`app-main-24a2.js`, map-rtg) |
| bedienbaar | NIET_GETEST | geen scenario | |
| menselijk | NIET_GETEST | geen scenario | |
| voltooibaar | GEEN_FIXTURE | geen scenario | |
| waarheidsgetrouw | NIET_GETEST | geen scenario | |
| persistent | GEEN_FIXTURE | geen scenario | |
| bevoegd | NIET_GETEST | geen scenario | BEVOEGD: NIET_GETEST (kiezer, geen eigen adres); IDOR: eigen-gezin 5 routes onbereikbaar (de meter had geen id van A, dus niet bewezen) |
| herstelbaar | GEEN_FIXTURE | geen scenario | |

Wel bewezen in een losse toets: `test/gezinssessie-gedeeld-toestel.e2e.js` (commit af89167b). Logt A uit en logt B in, of blijft het toestel open liggen en logt B in, dan staat er geen gezinssessie meer in de browser en opent het token van A op de server niets meer. Verder bestaan er toetsen op de onderdelen, zoals `gezinseigenaar.test.js`, `gezinssessie.test.js`, `gezinstoken.test.js`, `gezinmeenemen.test.js` en `toegang-gezin.test.js` (genoemd in `accountplicht.js`). Hun uitslag van vandaag heb ik niet gezien.

**Wat de code doet (gelezen):**
- **De kiezer.** `public/apps/app-main/app-main-24a1.js` (`OSAPPS.rtf`, `RTF_GROEPEN`) en `app-main-26.js` (`openOsApp('rtf')`): per groep een knop met de markering "vorige keer" (uit `localStorage` `rtf_app_groep`), die naar `/apps/foundation/index.html?groep=<g>` navigeert. Accountcontrole of serververzoek is er hier niet. `scripts/lib/wereldregister.js` noemt dit bewust "kiezer in de app" en geeft het geen adres.
- **De bril op de deur.** `index.html` (`GROEP_APPS`, `toonRol`): de groep uit de URL wordt onthouden. De groep van het *profiel* gaat voor die van de ingang; tegels met `data-grp` buiten die groep worden verborgen. Werk en vacatures alleen vanaf 16 (`magSolliciteren`). Dromen en het fotoboekje niet voor gasten.
- **De vier standen van de deur:** `vWelkom` (welkom, met "Mijn leven" als link naar `/apps/leven.html`), `vProfielen` (profiel kiezen), `vVoorzijde` (de rustige voorzijde met de panelen dag, groei — "Niet vergelijken met een ander", "U bent geen score" — en kring) en `vHub` (de tegelwand, met de secties `secOuder` en `secKind`, en `hImpact` uit `/api/foundation/impact`).
- **Mijn gezin** (`public/apps/foundation/eigen-gezin.js`, `server/routes/member/gezin.js`, `server/foundation/gezinseigenaar.js`):
  - `/api/rtf/eigen-gezin` (overzicht met `paspoortGecontroleerd` en `achttienPlus`);
  - `/maak`: alleen met een eigen account en een *opgegeven* leeftijd van 18 of ouder, plus de verklaringen "bevoegd" en "privacy";
  - `/sessie`: de ouder zelf, of een kind alleen met `volwassen()`;
  - `/kind`: alleen met `volwassen()`; geldige geboortedatum, jonger dan 18; een dubbele tik geeft hetzelfde profiel terug; maximaal 12 profielen;
  - `/koppel`: een gezin van vóór 5 oktober meenemen met gezinscode en PIN, met een rem.
- **Accountplicht** (`server/foundation/accountplicht.js`): buiten de demo opent een token alleen iets in een gezin met een eigenaar-account. Een beschermd profiel opent alleen als die eigenaar `volwassen()` is, en dat wordt bij elk verzoek opnieuw gerekend. `/gezin/maak` en `/gezin/profiel/maak` voor een kind zijn dichtgezet met de verwijzing naar Mijn gezin. Zes routefamilies krijgen een 401 met `accountNodig`.
- **Sessie in de browser** (`public/apps/foundation/sessie/sessie-00.js` t/m `sessie-03.js`):
  - `rtf_sessie` in `localStorage`; afmelden trekt de sessie op de server in (`/api/foundation/gezin/sessie/intrek`);
  - profiel wisselen bewaart de lopende sessie als `wissel` tot het volgende profiel met zijn eigen pincode binnen is;
  - de toegangscontrole per scherm (`BESCHERMDE_APPS`, 58 schermsleutels) vraagt `/api/rtf/toegang`. Zonder antwoord blijft het scherm dicht ("Uit veiligheid blijft deze ruimte dicht");
  - een 401 met `accountNodig` wist de sessie en wijst naar de gezinsdeur;
  - `sessie-03.js` legt de wereldschil met zes bestemmingen vast: Thuis, Campus, Elke dag, Samen, Steun en Beheer.
- **Leeftijdspoort op de server** (`server/routes/rtfbieb.js`, `/api/rtf/toegang`): een kindprofiel zonder geboortedatum blijft dicht ("een handmatig gekozen groep is geen leeftijdsbewijs"), gasten krijgen geen leren, spelen of geld, en de browser ontvangt alleen het besluit.
- **Gezinstoken.** Hij bestaat alleen als hash en is 7 dagen geldig, te verlengen met een passkey (`server/foundation/gezinstoken.js`, besluit B19).
- **Gedeeld toestel** (`public/apps/app-main/app-main-04.js`, `sluitGezinssessie`): bij uitloggen of bij een nieuwe inlog wordt `rtf_sessie` gewist en op de server ingetrokken. Een serverregel die de gezinssessie aan de lidsessie bindt, volgt nog (opdrachtbrief).
- **Gezin wissen** (`server/foundation/zorg.js`): met meer dan één volwassene moet een tweede volwassene bevestigen. Verwijdert de ouder zijn account (`vergeetAccount`), dan gaat het gezin mee.
- **Productie.** `/api/foundation/gezin` en de meeste `/api/rtf/*`-families staan in `BESCHERMDE_ROUTEFAMILIES` en geven 503 zonder extern vrijgavedossier. `/api/rtf/eigen-gezin` staat niet in die lijst, maar de sessie die het geeft, opent daarachter dan nog weinig.
- **Gezinsregel in Heel RTG.** Commit `3d0e386f` ("de schermen van de RTFoundation die op een gezinssessie draaien, alleen met een gezinssessie", in `app-main-29d.js`) bestaat in de repository, maar zit **niet** in de tak `appwerkt/foundation` waarop ik las: `app-main-29d.js` bevat het woord `gezinssessie` hier niet. In deze werkboom is de regel dus niet aanwezig.

### b. Marktvergelijking

| leider | pakket (ook het duurste) | prijs (alleen uit zoekresultaat) | kernfuncties | bron |
|---|---|---|---|---|
| Google Family Link | één gratis app | gratis (App Store-vermelding) | daglimieten, school- en rusttijden, tijd per app, goedkeuren of blokkeren van apps, locatie van het toestel, filters op Google-diensten | Family Link — https://families.google/familylink/ (opdrachtbrief); App Store — https://apps.apple.com/app/1150085200 (zoekresultaat 2026-10-19, pagina niet geopend) |
| Apple Family Sharing | gezinsgroep tot 6 personen | geen gegevens | Ask to Buy (de ouder keurt een download goed), Schermtijd met Communication Limits (wie het kind mag spreken, ook tijdens Downtime) | Apple Family Sharing — https://www.apple.com/family-sharing/ (opdrachtbrief); MobileSyrup — https://mobilesyrup.com/2021/11/10/heres-how-apples-family-sharing-and-parental-controls-work/ (zoekresultaat 2026-10-19, pagina niet geopend) |
| Microsoft Family Safety | onderdeel van Microsoft 365 Family (tot 6 personen) | €109 per jaar voor Microsoft 365 Family bij een Ierse wederverkoper; geen officiële prijs gevonden; Family Safety zelf niet in de resultaten | geen gegevens over Family Safety uit de zoekresultaten | Microsoft — https://www.microsoft.com/en-us/microsoft-365/family-safety (opdrachtbrief); wederverkoper — https://redmondelectric.ie/products/microsoft-softwares-6gq-01897 (zoekresultaat 2026-10-19, pagina niet geopend) |
| Qustodio | Basic (tot 5 toestellen); Complete (duurste, onbeperkt aantal toestellen) | Complete $109.95 per jaar (officiële pagina); promoties $99.95 en $104.95 | kernveiligheid plus geavanceerde functies, volledig instelbaar | Qustodio — https://www.qustodio.com/premium (zoekresultaat 2026-10-19, pagina niet geopend) |

**Welke kernfuncties wij hebben:**
- gezin met profielen en een maximum: **ja** (12 profielen, `MAX_PROFIELEN`);
- ouder bevestigt dat het kind er is, met identiteitscontrole van de ouder: **ja**, en strenger dan de markt (paspoort via `volwassen()`);
- ouder keurt contacten goed: **ja** (in Vrienden);
- ouder keurt aankopen of apps goed: **half**. De App-Bibliotheek (`/api/rtf/bieb/installeer`) toont alleen wat bij de leeftijd past, en gasten installeren niet; een goedkeuringsstap van de ouder heb ik niet gezien;
- leeftijdsafhankelijk aanbod: **ja** (server: `/api/rtf/toegang`);
- schermtijd en limieten: **nee**;
- rusttijd of downtime: **nee** (RTF-12);
- locatie van het kind: **nee** in de tegel. `rtf.veilig-thuis` laat het kind zelf melden waar het is; dat is een andere eigenaar;
- veilig gedeeld toestel (profielwissel met pincode, intrekking bij uitloggen): **ja**, en dat is bij de leiders geen genoemde kernfunctie;
- meerdere ouders op één kind: **half** (RTF-10).

### c. Het volledige domein

**Hoe het echt gaat.**
- *Particulier.* Een gezin deelt vaak één tablet of laptop. Ouders zetten afspraken neer over tijd, plekken (geen schermen aan tafel of in de slaapkamer) en inhoud. De afspraken schuiven met de leeftijd mee: van "samen kijken" bij de kleinsten naar "zelf bepalen met afspraken" bij tieners. Gescheiden ouders hebben vaak allebei gezag maar elk een eigen huishouden.
- *Professioneel.* Jeugdverpleegkundigen (consultatiebureau, JGZ), leerkrachten en pedagogisch medewerkers adviseren over mediaopvoeding. Het NJi heeft een Toolbox Mediaopvoeding voor professionals. Zij vallen onder de Meldcode (zie Vrienden, c).
- *Organisatorisch.* Scholen bepalen het schermgebruik op school. Gemeenten (jeugdhulp onder de Jeugdwet) en de JGZ zijn de publieke dragers.

**Regels en keurmerken.**
- **AVG/UAVG**: toestemming onder 16 via de ouder, met redelijke verificatie (bron als bij Vrienden).
- **Code voor Kinderrechten**: het belang van het kind, geen profilering, privacy by design (bron als bij Vrienden).
- **DSA artikel 28**: richtsnoeren als referentiekader (bron als bij Vrienden).
- **Richtlijn Gezond Schermgebruik / MediaDiamant** (maart 2026): leeftijdsgebonden advies over schermgebruik, de ouder als voorbeeld, vroeg afspraken maken. De GGD-webinar uit 2022 noemt een tabel per leeftijd. Die getallen neem ik niet over, omdat het zoekresultaat zelf zegt ze tegen de huidige richtlijn te controleren. Bronnen: Netwerk Mediawijsheid — https://netwerkmediawijsheid.nl/wp-content/uploads/2026/03/Persbericht-lancering-vernieuwde-MediaDiamant.pdf ; NJi — https://www.nji.nl/actueel/informatie-over-gezond-schermgebruik-voor-de-week-van-de-mediawijsheid ; tips voor ouders — https://www.mediawijsheid.nl/wp-content/uploads/sites/4/2025/06/WvdM25-tipsvoorouders-v2.pdf (zoekresultaat 2026-10-19, pagina niet geopend).
- **Jeugdwet en gezag.** Wie gezag heeft, bepaalt wie namens het kind toestemming geeft. Een artikelnummer heb ik niet. Dat is relevant voor co-ouders (RTF-10).

**Wat daaruit volgt voor de tegel.**
1. De leeftijdskeuze in de kiezer mag een bril blijven, maar mag nooit iets openen. Dat doet hij nu ook niet, want `profiel.groep` en de server beslissen. Die afspraak moet in een voltooiscenario staan.
2. Een geboortedatum die de ouder heeft opgegeven, moet zichtbaar opgegeven blijven (`leeftijdBron`).
3. Mediaopvoeding draait om afspraken en niet om meten. Een rusttijd past daarbij (RTF-12); een schermtijdteller als cijfer op een kind niet (geen cijfer op een mens, FOUNDATION 5.4; geen vergelijken).
4. Gezag kan bij twee mensen liggen, en dat is nu half geregeld (RTF-10).

### d. Functiecatalogus L1–L6

- **L1 Persoonlijk:** sterk. Kiezer, deur, Mijn gezin, profielwissel en afmelden bestaan, maar niets ervan zit in een voltooiscenario.
- **L2 Professioneel (bestaande genres):** zwak. Een gast (oppas of familie) bestaat via een persoonlijke uitnodiging. Een professionele oppas onder een bestaand genre is niet aangesloten.
- **L3 Organisatorisch:** half. Het gezin is een organisatie met een beheerder, rollen en een tweede volwassene bij het wissen. Co-ouderschap via twee accounts ontbreekt.
- **L4 Domeinintelligentie:** afwezig. Geen samenvatting voor de ouder en geen rusttijd.
- **L5 Volledige levenscyclus:** half. Maken, toevoegen, meenemen en wissen bestaan. De overgangen (groep wisselt, 16, 18) gebeuren stil.
- **L6 RTG-samenhang:** half. "Mijn leven" is als link aanwezig, en het gedeelde toestel is in de browser gedicht. De gezinsregel in Heel RTG staat niet in deze tak, en de serverregel ontbreekt.

**RTF-01 Leeftijdskiezer** · L1 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (in het scenario)
- Gegevens en bron: `RTF_GROEPEN` (`app-main-24a1.js`) en `rtf_app_groep` in `localStorage`.
- Regels en rekenwijze: de keuze navigeert alleen. De groep van het profiel gaat voor (`toonRol`).
- Onzekerheid: geen; de keuze geeft geen rechten.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: iedereen in de RTG-app.
- Uitzonderingen: zonder geopend profiel toont de deur alleen het welkomscherm.
- Acceptatiecriterium: Gegeven een kindprofiel van 9 jaar, wanneer iemand in de kiezer "RTF Jong" kiest en dat profiel opent, dan krijgt het profiel de bril van groep `kind`, en geeft `/api/rtf/toegang` voor `werk` 403.

**RTF-02 De gezinsdeur (welkom, profielen, voorzijde, tegelwand)** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (in het scenario)
- Gegevens en bron: `index.html`, `/api/foundation/gezin/<code>/mij`, en `/api/foundation/impact` (geaggregeerd: opgehaald bedrag, aantal scholen en gezinnen).
- Regels en rekenwijze: de tegels per groep; werk vanaf 16; dromen en fotoboekje niet voor gasten; het groeipaneel zonder vergelijking ("U bent geen score").
- Onzekerheid: de impactcijfers zijn tellingen van de stichting. Of `/api/foundation/impact` "niet gemeten" anders toont dan nul, heb ik niet vastgesteld (de deur verbergt het blok als alles 0 of leeg is).
- Wie hoort wat, wanneer: het profiel zelf.
- Rollen en toestemming: per profiel.
- Uitzonderingen: in productie zonder dossier geeft `/api/foundation/gezin` 503.
- Acceptatiecriterium: Gegeven een geopend ouderprofiel, wanneer de deur laadt, dan ziet de ouder `secOuder` en niet `secKind`, en het kindprofiel ziet het omgekeerde.

**RTF-03 Mijn gezin via het ouderaccount** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (in het scenario)
- Gegevens en bron: `gezinseigenaar.js` (eigenaar = account-id plus codenaam, geen echte naam) en `member/gezin.js`.
- Regels en rekenwijze: een gezin maken met een opgegeven leeftijd van 18 of ouder; een kind toevoegen en een kindersessie openen alleen met `volwassen()` (account, A3 en 18 jaar); een kind onder 18; maximaal 12 profielen; een dubbeltik geeft geen tweede kind.
- Onzekerheid: de geboortedatum van het kind is door de ouder opgegeven.
- Wie hoort wat, wanneer: de ouder ziet bij elk antwoord waarom iets dicht is (`hoe: 'paspoort'`).
- Rollen en toestemming: alleen het eigen account.
- Uitzonderingen: een gezin van vóór 5 oktober kan worden meegenomen (`/koppel`, met een rem).
- Acceptatiecriterium: Gegeven een account met een opgegeven leeftijd van 30 en zonder gecontroleerd paspoort, wanneer het een kind wil toevoegen, dan krijgt het 403 met "zodra RTG je paspoort heeft gecontroleerd", en na de keuring lukt het.

**RTF-04 Profiel wisselen op één toestel** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (in het scenario)
- Gegevens en bron: `wissel()` in `sessie-00.js`, en de pincode van het profiel.
- Regels en rekenwijze: de lopende sessie blijft als `wissel` tot het volgende profiel met zijn eigen pincode binnen is. De nieuwe sessie eindigt waar de oude eindigde; de server verlengt bij wisselen niets.
- Onzekerheid: een kindprofiel heeft via Mijn gezin geen eigen pincode ("Een kind krijgt geen eigen pincode van deze route"). Hoe een kind dan terugwisselt, heb ik niet vastgesteld.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: per profiel.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een ouder en een kind op één tablet, wanneer het kind het ouderprofiel kiest, dan vraagt de deur de pincode van de ouder, en zonder die pincode blijft de kindersessie actief.

**RTF-05 Afmelden en gedeeld toestel (browser)** · L1/L6 · bestaat · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `afmelden` in `sessie-00.js`, `sluitGezinssessie` in `app-main-04.js`, en `/api/foundation/gezin/sessie/intrek` (in productie een veilige uitgang).
- Regels en rekenwijze: bij uitloggen of een nieuwe inlog wordt de sessie uit de browser gewist en op de server ingetrokken, met `keepalive`.
- Onzekerheid: lukt de intrekking niet (offline), dan verloopt het token na hooguit 7 dagen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: iedereen.
- Uitzonderingen: geen.
- Acceptatiecriterium: bewezen door `test/gezinssessie-gedeeld-toestel.e2e.js`, met twee wegen.

**RTF-06 Serverregel: de gezinssessie hoort bij de lidsessie die haar opende** · L1/L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: het gezinstoken (`gezinstoken.js`) en de sessie van het lid.
- Regels en rekenwijze: een gezinstoken dat via `/api/rtf/eigen-gezin/sessie` is uitgegeven, draagt de sleutel van de lidsessie. Eindigt die lidsessie, dan vervalt ook het gezinstoken op de server, ook als de browser nooit `intrek` stuurde.
- Onzekerheid: wie de sessie *zonder* account kreeg (testomgeving, oude gezinnen), valt erbuiten.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: geen nieuw rechtenmodel; het is een verval op een bestaand token.
- Uitzonderingen: een passkey-verlenging van het eigen profiel (B19) volgt dezelfde regel.
- Acceptatiecriterium: Gegeven een gezinssessie uit Mijn gezin, wanneer de ouder op een ander toestel "overal uitloggen" kiest, dan geeft het gezinstoken binnen één verzoek 401.

**RTF-07 Leeftijdspoort per scherm** · L1 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (in het scenario)
- Gegevens en bron: `/api/rtf/toegang` (`rtfbieb.js`), `rtf.leerlingPassen`, en `BESCHERMDE_APPS` (in de browser, alleen om het slot te tonen).
- Regels en rekenwijze: geen geboortedatum betekent dicht voor een kind; een gast krijgt geen leren, spelen of geld; Campus alleen voor een leerling.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het scherm toont de reden.
- Rollen en toestemming: de server beslist.
- Uitzonderingen: is de controle onbereikbaar, dan blijft het scherm dicht.
- Acceptatiecriterium: Gegeven een kindprofiel zonder geboortedatum, wanneer het `/apps/foundation/klusjes.html` opent, dan blijft het slot staan met "Vul eerst de geboortedatum in".

**RTF-08 Oppas en familie als gast** · L2 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (onderhoud)
- Gegevens en bron: `/api/rtf/uitnodiging/accepteer`, `/api/rtf/ontkoppel`, `/api/rtf/kanaal` en `/api/rtf/bericht` (`member/gezin.js`). Koppelen met alleen een code geeft buiten de testomgeving 410.
- Regels en rekenwijze: een persoonlijke, eenmalige uitnodiging. De gast leest het kanaal, ziet geen privézaken (`isGast`) en doet niet mee in Vrienden.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de gezinsmeldingen landen in de app van de gast.
- Rollen en toestemming: het gezin nodigt uit.
- Uitzonderingen: in productie staan deze routes in de beschermde lijst (503 zonder dossier).
- Acceptatiecriterium: Gegeven een oma met een eigen RTG-account en een uitnodiging, wanneer zij accepteert, dan leest zij het gezinskanaal, en `/api/rtf/social/connections` geeft voor haar 403.

**RTF-09 Professionele oppas onder een bestaand genre** · L2 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: genre kinderopvang met persoonseis `werk` (`persoonseis.js`, `vakbewijs.js`).
- Regels en rekenwijze: een gast die via een gekeurde kinderopvangzaak komt, draagt in het gezin het label van die zaak. Zijn sessie werkt alleen zolang de persoonseis geldt; dat wordt bij elke vraag opnieuw gerekend.
- Onzekerheid: RTG valideert het stuk niet inhoudelijk.
- Wie hoort wat, wanneer: de ouder ziet het label en het verval.
- Rollen en toestemming: de ouder nodigt uit; RTG tekent het vakbewijs af, nooit de werkgever.
- Uitzonderingen: een particuliere oppas (geen zaak) blijft een gewone gast zonder label.
- Acceptatiecriterium: Gegeven een oppas van een kinderopvang wiens vakbewijs verloopt, wanneer hij het gezinskanaal opent, dan is zijn sessie dicht, en ziet de ouder waarom.

**RTF-10 Twee ouders, twee accounts (co-ouderschap)** · L3 · half · kosten middel · complexiteit hoog · later (eigenaarsbesluit)
- Gegevens en bron: rollen `beheerder` en `ouder` bestaan, en wissen vraagt een tweede volwassene (`zorg.js`). `accountGezin(userId)` vindt een gezin alleen via `g.eigenaar.userId`. Een tweede ouder kan het gezin dus niet via zijn eigen account openen ("Een andere beheerder logt zelf in", maar alleen binnen het gezin van de eigenaar).
- Regels en rekenwijze: een tweede ouder met een eigen account en een gekeurd paspoort wordt mede-beheerder via een uitnodiging. Beslissingen die het kind raken (contact goedkeuren, functie uitzetten) mogen door elk van beiden, met een regel in het journaal, zoals Messenger Kids meerdere ouders laat beheren. Wissen blijft met twee.
- Onzekerheid: wie gezag heeft, kan RTG niet vaststellen. RTG valideert dat niet en doet niet alsof. Een verklaring van de uitnodigende ouder is geen bewijs.
- Wie hoort wat, wanneer: elke ouder ziet wat de andere omzette.
- Rollen en toestemming: [besluit] mag de eigenaar een tweede ouder ook weer verwijderen, en wat gebeurt er bij een conflict tussen gescheiden ouders?
- Uitzonderingen: de beschermingsdeur blijft open voor het kind, ook tegenover een ouder.
- Acceptatiecriterium: Gegeven twee ouders met elk een gekeurd paspoort, wanneer ouder 2 de uitnodiging accepteert, dan opent hij het gezin vanuit zijn eigen account, en staat elke wijziging van hem in het journaal van het kind met zijn codenaam.

**RTF-11 Ouderoverzicht "wie, niet wat"** · L4 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: projecties zonder kopie: het aantal wachtende contactverzoeken (`teKeuren`), nieuwe contacten in de kring, wijzigingen in de kinder-boardroom (`lidBoardLog`), en of het paspoort gekeurd is.
- Regels en rekenwijze: alleen aantallen en codenamen, nooit berichttekst, foto's of tijd per app. "Niet gemeten" staat er als "niet gemeten", niet als 0.
- Onzekerheid: geen voorspelling; alleen feiten met een tijdstip.
- Wie hoort wat, wanneer: de beheerder, op de deur (`secOuder`).
- Rollen en toestemming: de beheerder, en bij RTF-10 ook de mede-ouder.
- Uitzonderingen: voor een tiener van 16 of ouder staat er niets (de tiener is baas over zijn kring).
- Acceptatiecriterium: Gegeven een kind met één wachtend verzoek, wanneer de ouder de deur opent, dan staat er "1 contactverzoek wacht op u" met een link naar Vrienden, zonder verdere inhoud.

**RTF-12 Rusttijd per kindprofiel** · L4 · ontbreekt · kosten middel · complexiteit midden · later
- Gegevens en bron: een instelling per kindprofiel in de bestaande kinder-boardroom (geen nieuwe motor). Handhaving in `gezinsPoort` en `profielVan`.
- Regels en rekenwijze: binnen de rusttijd openen de schermen voor ontspanning en contact niet. School, Steun, Onveilig en het gezinskanaal blijven open. Er wordt niets geteld, er is geen tijd-per-app-meting en geen teller op het kind (geen cijfer op een mens), alleen een venster. Dit sluit aan bij het advies om afspraken te maken (MediaDiamant).
- Onzekerheid: geen.
- Wie hoort wat, wanneer: het kind ziet "rust tot 7:00, afgesproken met je ouder".
- Rollen en toestemming: de ouder stelt in, het kind ziet het, en het journaal toont `door: 'ouder'`.
- Uitzonderingen: de beschermingsdeur gaat altijd open.
- Acceptatiecriterium: Gegeven een rusttijd van 20:30 tot 7:00 voor een kind van 8, wanneer het om 21:00 de Speelhal opent, dan ziet het het rustscherm, en `/apps/foundation/onveilig.html` opent gewoon.

**RTF-13 Overgang van leeftijdsgroep** · L5 · ontbreekt · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: `actualiseerGroep` (op de verjaardag).
- Regels en rekenwijze: bij een groepswissel (5, 12, 16, 22) ziet het profiel één keer een uitleg in gewone taal over wat er nu anders is. De ouder krijgt een seintje bij 12 en 16. Er staat geen niveau, badge of "level up" in (`progressieMag`).
- Onzekerheid: de geboortedatum is door de ouder opgegeven.
- Wie hoort wat, wanneer: het profiel en de beheerder.
- Rollen en toestemming: geen.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een kind dat vandaag 12 wordt, wanneer het de deur opent, dan ziet het één keer "Je bent nu RTF Tiener: dit kun je nu", en verschijnt die uitleg daarna niet nog eens.

**RTF-14 Op 18 een eigen account** · L5 · ontbreekt · kosten middel · complexiteit hoog · later
- Gegevens en bron: een kindprofiel mag niet 18 of ouder zijn ("Wie 18 of ouder is, maakt een eigen account"). Wat er gebeurt met een profiel dat 18 *wordt*, heb ik niet gevonden.
- Regels en rekenwijze: een maand vooraf krijgt de jongere de uitnodiging om een eigen account te maken. Daarna neemt hij met één bevestiging zijn eigen leerdossier en kring mee, via een verwijzing en een overdracht door de eigenaar van elk stuk, niet als kopie door de tegel. Het profiel in het gezin wordt daarna een gewone band.
- Onzekerheid: per app verschilt wat meegaat. Twijfel: aan de integrator voorleggen.
- Wie hoort wat, wanneer: de jongere en de beheerder.
- Rollen en toestemming: de jongere beslist. De ouder kan het niet tegenhouden.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een profiel dat over 30 dagen 18 wordt, wanneer de jongere de uitnodiging accepteert, dan opent hij zijn leerdossier vanuit zijn eigen account, en kan de ouder dat dossier daarna niet meer openen.

**RTF-15 Gezin wissen en account verwijderen** · L5 · bestaat · kosten klein · complexiteit midden · aanbevolen nu (in het scenario)
- Gegevens en bron: `/gezin/wissen`, `/gezin/wissen/bevestig` en `vergeetAccount`.
- Regels en rekenwijze: met meer dan één volwassene bevestigt een tweede volwassene. Bij het verwijderen van het account gaat het gezin mee. Ontbreekt een wisser, dan gooit de functie een fout en volgt geen stille no-op.
- Onzekerheid: of de sociale sporen meegaan, is niet vastgesteld (zie Vrienden VRI-18).
- Wie hoort wat, wanneer: de tweede volwassene krijgt het verzoek.
- Rollen en toestemming: ouder of beheerder, met pincode.
- Uitzonderingen: oude anonieme gezinnen worden niet vóór 6 november 2026 gewist (tekst op de deur).
- Acceptatiecriterium: Gegeven een gezin met twee volwassenen, wanneer de ene wissen vraagt, dan blijft het gezin staan tot de andere bevestigt, en daarna opent geen token van dat gezin nog iets.

**RTF-16 Herkomst van de leeftijd van het kind** · L5 · half · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: de geboortedatum van het kind uit `/kind` (opgegeven door de ouder). `leeftijdBron` bestaat voor leden (AGENTS.md).
- Regels en rekenwijze: de deur en Beheer tonen bij het kind "leeftijd opgegeven door ouder". Elke wijziging van de geboortedatum komt in het journaal.
- Onzekerheid: dit is precies het punt. De leeftijd is niet gecontroleerd en moet dat ook eerlijk zeggen.
- Wie hoort wat, wanneer: de ouder; het kind ziet het bij "Mijn profiel".
- Rollen en toestemming: alleen de beheerder kan de datum wijzigen.
- Uitzonderingen: een geboortedatum die het kind ouder maakt dan 15, vlak na een melding van het kind, wordt [besluit] eerst vastgehouden.
- Acceptatiecriterium: Gegeven een kindprofiel, wanneer de ouder de geboortedatum verandert, dan staat er in het journaal van het kind een regel met de oude groep, de nieuwe groep en `door: 'ouder'`.

**RTF-17 Gezinsregel in Heel RTG** · L6 · half (niet in deze tak) · kosten klein · complexiteit laag · aanbevolen nu
- Gegevens en bron: commit `3d0e386f` (op een andere tak), `app-main-29d.js` (`RTGAppCatalogusPoort`), en `scripts/world-widgets.js` volgens het commitbericht.
- Regels en rekenwijze: schermen die `sessie.js` laden, toont Heel RTG alleen bij een `rtf_sessie` met profiel. De deur `index.html` blijft altijd zichtbaar.
- Onzekerheid: samenvoegen met deze tak is niet gemeten.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: geen.
- Uitzonderingen: registreren, de wegwijzer, de OS-portalen, de winkel en Onveilig blijven staan.
- Acceptatiecriterium: Gegeven een lid zonder gezinssessie, wanneer het in Heel RTG "klusjes" zoekt, dan krijgt het geen treffer voor `/apps/foundation/klusjes.html`, wel de gezinsdeur.

**RTF-18 Mijn leven vanaf de deur** · L6 · bestaat (link) · kosten klein · complexiteit laag · aanbevolen nu (onderhoud)
- Gegevens en bron: `#aLeven` naar `/apps/leven.html` (`leven.werkblad`). Het commentaar zegt dat koppelen fase 2 van LEVEN.md is, en "half koppelen is erger dan niet koppelen".
- Regels en rekenwijze: alleen een link, geen gegevens.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: niemand.
- Rollen en toestemming: het lid.
- Uitzonderingen: geen.
- Acceptatiecriterium: Gegeven een ingelogd lid op het welkomscherm, wanneer het op "Mijn leven" tikt, dan opent `/apps/leven.html` met zijn lidsessie, en gaat er geen gezinstoken mee.

**RTF-19 Voltooiscenario `os:rtf`** · L6 · ontbreekt · kosten klein · complexiteit midden · aanbevolen nu
- Gegevens en bron: de vorm van `scripts/lib/voltooi/*.js` en `voltooigezin.js`.
- Regels en rekenwijze: de stappen zijn kiezer → deur → Mijn gezin maken → kind toevoegen (eerst geweigerd, na keuring geopend) → kindersessie → leeftijdspoort (een niet passende groep in de kiezer opent niets) → profiel wisselen → afmelden → gedeeld toestel. Verder persistent (herstart, sessie nog geldig) en herstelbaar (dubbeltik op kind toevoegen geeft één kind; afgebroken `/maak`).
- Onzekerheid: de kiezer zelf heeft geen adres, dus het scenario begint in de browser.
- Wie hoort wat, wanneer: n.v.t.
- Rollen en toestemming: ouder met keuring, ouder zonder keuring, kind, gast, vreemde.
- Uitzonderingen: in de wereld van de proef geldt de accountplicht (`RTF_GEZIN_ACCOUNTPLICHT=1`).
- Acceptatiecriterium: Gegeven de proefwereld, wanneer het scenario draait, dan sluiten voltooibaar, persistent en herstelbaar, en staat `os:rtf` in APPWERKT niet meer op GEEN_FIXTURE.

**RTF-20 Goedkeuring door de ouder voor apps uit de App-Bibliotheek** · L4 · ontbreekt · kosten klein · complexiteit midden · later
- Gegevens en bron: `/api/rtf/bieb/installeer` (al begrensd per leeftijdsgroep; gasten installeren niet).
- Regels en rekenwijze: voor een beschermd profiel wordt "installeren" een verzoek aan de beheerder, zoals Ask to Buy. Er is geen geld mee gemoeid.
- Onzekerheid: geen.
- Wie hoort wat, wanneer: de beheerder via RTF-11.
- Rollen en toestemming: de beheerder.
- Uitzonderingen: apps voor Steun, Onveilig en School vragen geen goedkeuring (de beschermingsdeur).
- Acceptatiecriterium: Gegeven een kind van 10 dat een spel installeert, wanneer het op installeren tikt, dan staat het verzoek bij de ouder, en verschijnt het spel pas na een akkoord.

**RTF-21 Schermtijdteller of ranglijst per kind** · L4 · niet doen
- Reden: dat is een cijfer op een mens en vergelijking tussen kinderen (FOUNDATION 5.4, `progressieMag`). Mediaopvoeding draait om afspraken, en daarvoor is er RTF-12.

**RTF-22 Locatie van het kind volgen vanuit de tegel** · L4 · niet doen
- Reden: dat is een tweede implementatie naast `rtf.veilig-thuis`, waar het kind zelf meldt waar het is, en het is toezicht op wat in plaats van op wie.

**RTF-23 Ouder leest alles van een tiener** · L3 · niet doen
- Reden: `rtf.wie-mag-zien` zegt "zonder dat ouders automatisch meekijken", en vanaf 16 is de open laag van de tiener.

### e. RTG-exclusief

1. **Kind binnen alleen via een gekeurde ouder.**
   - Keten: RTG-account (identiteit) → paspoortkeuring door een mens van RTG (`identiteit.verificatie`) → `volwassen()` → Mijn gezin (`rtf.start`) → kindprofiel → elk verzoek opnieuw gerekend in `profielVan`.
   - Eigenaars: identiteit keurt, de tegel en de deur lezen alleen de uitkomst. Een ingetrokken keuring sluit ook een lopende kindersessie. Dat bieden de leiders in de tabel niet.
2. **Eén toestel, veel profielen, geen lek.**
   - Keten: lidsessie (RTG-app, `app-main-04.js`) → gezinssessie (`sessie-00.js`) → intrekking op de server bij uitloggen of bij wisselen van account.
   - Eigenaars: RTG-app en FoundationOS.
   - Met RTF-06 wordt dit ook een serverregel.
3. **De leeftijdspoort die over alle Foundation-apps heen geldt.**
   - Keten: geboortedatum (Mijn gezin) → groep (`gezinshulp.js`) → `/api/rtf/toegang` (App-Bibliotheek) → elk scherm via `BESCHERMDE_APPS` → Vrienden (`isBeschermd`).
   - Eén regel, op één plek gerekend, en door vele apps gelezen.
4. **Het gezin als projectie in de levensgraaf** (later, LEVEN.md fase 2). "Mijn leven" toont het gezin als band, met rechten per relatie, zonder dat Leven gezinsgegevens bezit.

### f. Bouwstenen en ontbrekende koppelingen

**Wat er staat:**
- `app-main-24a1.js` en `app-main-26.js` (de kiezer), `scripts/lib/wereldregister.js` (`OSAPPS`);
- `public/apps/foundation/index.html`, `eigen-gezin.js` en `sessie/sessie-00..03.js`;
- `server/routes/member/gezin.js`, `server/foundation/gezinseigenaar.js`, `accountplicht.js`, `gezinstoken.js` en `zorg.js` (wissen);
- `server/routes/rtfbieb.js` (`/api/rtf/toegang`), `app-main-04.js` (gedeeld toestel), `test/gezinssessie-gedeeld-toestel.e2e.js`;
- `server/middleware/foundation-productiepoort.js`.

**Wat ontbreekt, per koppeling:**
- Lidsessie → gezinstoken: verval op de server (RTF-06). Een verwijzing naar de sleutel van de lidsessie op het token.
- Tak `appwerkt/foundation` → commit `3d0e386f`: samenvoegen (RTF-17).
- Vrienden, kinder-boardroom en App-Bibliotheek → deur: een ouderoverzicht (RTF-11). Een projectie van aantallen.
- Kinder-boardroom → `gezinsPoort`/`profielVan`: rusttijd (RTF-12). Een projectie van een stand.
- Persoonseis → gast: label en verval (RTF-09). Een projectie.
- Account van een tweede ouder → gezin: mede-beheer (RTF-10). Een verwijzing (`userId` op het profiel, zoals bij de beheerder).
- Profiel van 18 → eigen account: overdracht per eigenaar (RTF-14). Een verwijzing en de keten, geen kopie.
- `scripts/lib/voltooi/`: een scenario voor `os:rtf` (RTF-19).
- Productie: het externe vrijgavedossier voor `/api/foundation/gezin` en `/api/rtf/*`. Zonder dat dossier is de deur na het inloggen in productie grotendeels 503. Dat is een besluit van buiten de code.

### g. Prioritering

| functie | bak | kosten | complexiteit | afhankelijkheden |
|---|---|---|---|---|
| RTF-19 voltooiscenario | nu | klein | midden | `voltooigezin.js` |
| RTF-06 serverregel gedeeld toestel | nu | klein | midden | aangekondigd door Toegang |
| RTF-17 gezinsregel Heel RTG in deze tak | nu | klein | laag | samenvoegen van `3d0e386f` |
| RTF-11 ouderoverzicht "wie, niet wat" | nu | klein | midden | VRI-15 voor de boardroomregels |
| RTF-13 overgang van leeftijdsgroep | nu | klein | laag | geen |
| RTF-16 herkomst van de leeftijd | nu | klein | laag | journaal (bestaat) |
| RTF-01/02/03/04/07/15 in het scenario | nu | klein | laag | RTF-19 |
| RTF-12 rusttijd | later | middel | midden | kinder-boardroom; handhaving in de gezinspoort |
| RTF-20 goedkeuring van apps | later | klein | midden | RTF-11 |
| RTF-10 co-ouderschap | later | middel | hoog | eigenaarsbesluit (gezag, verwijderen, conflict) |
| RTF-09 professionele oppas | later | middel | hoog | bestaande genres; kantoor tekent af |
| RTF-14 overgang naar 18 | later | middel | hoog | overdracht per app-eigenaar; integrator |
| productie-opening | extern | — | — | extern vrijgavedossier (B8) |

### Uitkomst A — binnen de huidige architectuur en scope

Het pakket **"een gezinsdeur die zichzelf bewijst"**: RTF-19 (het scenario, met RTF-01/02/03/04/05/07/15 erin), RTF-06, RTF-17, RTF-11, RTF-13 en RTF-16.

Wat de gebruiker daarna kan dat hij nu niet kan:
- een **ouder** ziet op de deur in één regel wat er bij zijn kind op hem wacht (verzoeken, nieuwe contacten, wat hij zelf omzette), zonder iets te lezen wat van het kind is;
- de ouder weet dat "overal uitloggen" ook de gezinssessie op dat andere toestel sluit;
- een **kind** krijgt bij zijn verjaardag uitleg in plaats van een stille verandering;
- iedereen ziet eerlijk dat de leeftijd van het kind door de ouder is opgegeven;
- **RTG** heeft `os:rtf` eindelijk in het register (voltooibaar, persistent en herstelbaar gemeten);
- Heel RTG wijst niet langer naar gezinsschermen die zonder sessie dicht zijn.

Er komt geen nieuwe motor bij.

### Uitkomst B — het domeinmaximum

Het eindproduct: het gezinsbesturingssysteem waarop ouders, professionals en de stichting samenwerken rond een kind. Daarbij gelden toezicht op wie en niet op wat, afspraken in plaats van metingen, en een kind dat bij elke stap volwassener wordt in zijn eigen rechten.

**Nieuwe professionele processen (elk onderdeel met [besluit] vraagt een eigenaarsbesluit):**

1. **Mediaopvoeding met de jeugdverpleegkundige** [besluit: nieuw genre JGZ, vóór V1 niet doen]
   - Wie: een jeugdverpleegkundige (JGZ). Dit genre staat niet in `bewijs.js`, dus het is een nieuw genre.
   - Proces: de ouder deelt op uitnodiging een gezinsafspraak (rusttijd, RTF-12), niet het gebruik → gesprek → aangepaste afspraak, die de ouder bevestigt.
   - Nodig: een nieuw genre [besluit], een verwerkersovereenkomst met de GGD [extern], en Wet BIG en Wkkgz voor de professional [wet].
2. **Gezamenlijk gezag organiseren** (RTF-10) [besluit]
   - Wie: twee ouders en eventueel een mediator. Een mediator past niet in een bestaand genre [besluit].
   - Proces: tweede ouder uitnodigen → keuring → mede-beheer → bij een conflict geldt de strengste instelling tot beiden akkoord zijn → het journaal is zichtbaar voor beiden.
   - Wet: gezag volgens het familierecht. RTG stelt dat niet vast.
3. **Kinderopvang en buitenschoolse opvang als vertrouwde gast** (RTF-09)
   - Wie: een pedagogisch medewerker (bestaand genre kinderopvang, persoonseis `werk`).
   - Proces: de zaak meldt aan → RTG tekent het vakbewijs af → de ouder koppelt → overdrachtsberichten in het gezinskanaal → het label verloopt met het bewijs.
   - Alles binnen bestaande genres.
4. **De overgang naar volwassenheid** (RTF-14)
   - Wie: de jongere, de ouder, en een mentor of decaan via School (`leren.school`).
   - Proces: uitnodiging op 17 jaar en 11 maanden → eigen account → overdracht per app-eigenaar (leerdossier, kring, geld via `geld.zakgeld`) → het gezinsprofiel wordt een band.
   - [besluit] Wat er per app meegaat.
5. **Jeugdhulp aan tafel** [besluit: nieuwe processen; extern; vóór V1 niet doen]
   - Wie: een jeugdhulpverlener onder de Jeugdwet. Een genre daarvoor bestaat niet.
   - Proces: de gemeente of een wijkteam nodigt uit via het gezin → het gezin deelt per band (`rtf.wie-mag-zien`) → het hulpplan staat bij de hulpverlener → het gezin ziet een verwijzing.
   - Alleen geaggregeerd naar gemeenten (LEVEN 2.6).
   - Nodig: een contract met de gemeente [extern], de Meldcode voor de professional [wet], en een DPIA [extern].
6. **Externe leeftijdsverificatie van het kind** [besluit + extern]
   - Bijvoorbeeld een geboorteakte die een RTG-medewerker heeft gezien, zodat `leeftijdBron` "gezien" wordt. Daarmee wordt de grens van 16 voor Vrienden en de AVG hard.
7. **Productie-opening** [extern]
   - Het externe vrijgavedossier (DPIA, juridisch) dat de beschermde familie in productie opent. Zonder dat dossier blijft dit alles een testhal.

De huisregels blijven ook in B gelden: geen schermtijdcijfer en geen ranglijst op een kind, geen inhoud voor ouders, de beschermingsdeur ook open tegenover een ouder, en elke stap die een instantie bereikt is één menselijke bevestiging.

### Ketens LOS en SAMEN

**LOS.** Zonder de andere apps is de kerntaak: een ouder maakt zijn gezin aan zijn account, voegt na de keuring een kind toe, en opent op het toestel het juiste profiel met de juiste bril.
- Staat de App-Bibliotheek (`/api/rtf/toegang`) uit, dan blijft elk beschermd scherm dicht met "De toegangscontrole is nu niet bereikbaar. Uit veiligheid blijft deze ruimte dicht".
- Staat de identiteitskeuring nog open, dan zegt de deur "Kinderfuncties gaan open zodra RTG uw paspoort heeft gecontroleerd" en is de knop van het kind uitgeschakeld.
- In productie zonder dossier geeft de deur na het inloggen voor gezinsdata 503 ("Deze functie is momenteel niet beschikbaar.").

**SAMEN — keten "Een nieuw gezin op een gedeelde tablet":**

| stap | wie | app-eigenaar |
|---|---|---|
| 1. Ouder tikt in LivingOS op RTFoundation en kiest "RTF Kids" | ouder | RTG-app (kiezer `os:rtf`, LivingOS) |
| 2. De deur opent; ouder kiest "Mijn gezin", wordt naar de inlog gestuurd als hij geen lidtoken heeft | ouder | `rtf.start` (`index.html`, `eigen-gezin.js`) |
| 3. Ouder maakt het gezin (18+ opgegeven) | ouder | `rtf.start` (eigen-gezin/maak) |
| 4. Ouder laat zijn paspoort keuren | ouder, mens van RTG | `identiteit.verificatie` (`/apps/verificatie.html`) |
| 5. Ouder voegt zijn dochter van 8 toe | ouder | `rtf.start` (eigen-gezin/kind) |
| 6. Ouder opent de sessie van zijn dochter op de tablet | ouder | `rtf.start` (eigen-gezin/sessie) |
| 7. Dochter opent Klusjes; de server geeft groep `kind` vrij | kind | `rtf.klusjes`; poort `/api/rtf/toegang` |
| 8. 's Avonds logt de ouder uit; zijn zoon logt met zijn eigen account in | ouder, zoon | RTG-app (`sluitGezinssessie`) |

**Storingen in deze keten:**
- *Stap 2, geen lidtoken.* Het venster zegt "Log in of maak een gratis account in de RTG-app" met een link. Er is bewust geen terugsprongadres (een open omleiding). Na het inloggen komt de ouder via FoundationOS of `#mijn-gezin` terug.
- *Stap 3, de opgegeven leeftijd ontbreekt of is onder 18.* "Een gezin maken kan vanaf 18 jaar. Ben je jonger? Vraag je ouder of verzorger om je toe te voegen."
- *Stap 4 valt uit* (keuring nog niet gedaan of ingetrokken). Stap 5 en 6 zijn uitgeschakeld met de reden. Een lopende kindersessie valt bij het volgende verzoek dicht.
- *Stap 5, de geboortedatum is ongeldig.* "Vul een geldige geboortedatum in, zodat de leeftijdspas klopt."
- *Stap 7, de App-Bibliotheek is onbereikbaar.* Het slot blijft staan; niets opent "voor de zekerheid".
- *Stap 7, de kiezer zei "RTF Jong" maar het profiel is 8.* De bril volgt het profiel. De keuze in de kiezer heeft geen effect op de rechten.
- *Stap 8, de intrekking komt niet aan* (offline). De browser is leeg, maar het token blijft op de server geldig tot het vervalt (hooguit 7 dagen). Dat is de reden voor RTF-06.
- *Productie zonder dossier.* Stap 2, 3, 5 en 6 werken (`/api/rtf/eigen-gezin` staat niet in de beschermde lijst), maar stap 7 en de deur na het openen van een profiel geven 503.

### h. Eindcontract Beyond Premium

1. **Breedte.** Criterium: kiezer, deur, Mijn gezin, kind toevoegen, profiel wisselen, afmelden, gast, ouderoverzicht, rusttijd en goedkeuring van apps bestaan. Meting: per functie een route plus een stap in het `os:rtf`-scenario.
2. **Professionele diepte.** Criterium: een professionele oppas staat alleen met een geldig vakbewijs in het gezin, en het verval sluit zijn sessie. Meting: een toets met een verlopen persoonseis.
3. **Levenscyclus.** Criterium: maken, kind toevoegen, groepswissels, 16, 18, wissen en verwijderen van het account werken, en laten niets achter. Meting: een scenario met een verzette klok, en een opslagzoektocht na het wissen.
4. **Samenwerking en rollen.** Criterium: beheerder, mede-ouder, kind, tiener, gast, professionele gast en vreemde hebben elk precies hun eigen rechten. Meting: BEVOEGD van NIET_GETEST naar alle kruisparen gescheiden, en IDOR op eigen-gezin bewezen in plaats van onbereikbaar.
5. **Domeinintelligentie.** Criterium: het ouderoverzicht toont alleen feiten met een tijdstip, nooit inhoud of tijd per app, en "niet gemeten" is geen 0. Meting: een toets op de payload van het overzicht.
6. **Los functioneren.** Criterium: zonder App-Bibliotheek, zonder keuring of zonder vrijgave zegt de deur per stap waarom iets dicht is, en opent er niets uit voorzorg. Meting: een toets met elk van die drie uitgeschakeld.
7. **RTG-ketens.** Criterium: de keten "nieuw gezin op een gedeelde tablet" loopt van de kiezer tot het uitloggen met accountwissel, en Heel RTG toont geen gezinsschermen zonder sessie. Meting: een scenario over meerdere apps, plus de toets van `3d0e386f`.
8. **Bewezen betrouwbaarheid.** Criterium: alle acht APPWERKT-bewijzen BEWEZEN voor `os:rtf`, inclusief menselijk en waarheidsgetrouw. Meting: APPWERKT.json na een nieuwe meting.

Dit contract komt bovenop de acht APPWERKT-bewijzen en vervangt ze niet.

### Behoeften buiten deze app

- **Profielen beheren, de leeftijd instellen en de gezinsgegevens.** `gezin.beheer` (`apps/foundation/beheer.html`). De tegel opent Beheer alleen en wijzigt zelf geen profielen.
- **Paspoortkeuring van de ouder.** `identiteit.verificatie` (`apps/verificatie.html`), getoond in `identiteit.rtgid-diensten` (`apps/rtgid.html`). De tegel leest alleen `volwassen()`.
- **Contacten van het kind.** `rtf.contacten` (`apps/foundation/vrienden.html`). Het ouderoverzicht (RTF-11) telt alleen en linkt erheen.
- **Wie wat mag zien binnen het gezin.** `rtf.wie-mag-zien` (`apps/foundation/mijnbanden.html`).
- **De gezinsagenda.** `agenda.afspraken` (`apps/foundation/agenda.html`). Een rusttijd (RTF-12) is geen agenda-item. Twijfel: aan de integrator voorleggen of de rusttijd als terugkerende afspraak in de agenda hoort of in de kinder-boardroom.
- **Zakgeld en geld van het kind.** `geld.zakgeld` (`apps/foundation/zakgeld.html`) en `geld.sparen` (`apps/foundation/geld.html`). De tegel toont geen saldo.
- **School en leerdossier.** `leren.school` (`apps/rtgschool.html`) en `rtf.school` (`apps/foundation/school.html`). De Campuspoort leest alleen de leerlingpas.
- **Uitleg over privacy.** `rtf.privacy-uitleg` (`apps/foundation/privacy.html`). Uitleg over rechten per leeftijd: `info.rechten` (`apps/foundation/rechten.html`).
- **Opvoedhulp en mediaopvoeding.** `gezin.opvoedhulp` (`apps/foundation/opvoeden.html`) en `rtf.mediawijs` (`apps/foundation/mediawijs.html`). De tegel linkt en bevat zelf geen advies.
- **Veilig thuis en locatie.** `rtf.veilig-thuis` (`apps/foundation/veilig.html`) en `rtf.onveilig` (`apps/foundation/onveilig.html`).
- **Het leven als geheel.** `leven.werkblad` (`apps/leven.html`), alleen als link. Koppelen is fase 2 van LEVEN.md.
- **Klusjes en sterren.** `rtf.klusjes` (`apps/foundation/klusjes.html`). Twijfel: aan de integrator voorleggen of "sterren" voor kinderen onder 18 onder `progressieMag` vallen. Dat is een vraag over een andere app, en ik heb het niet gemeten.
