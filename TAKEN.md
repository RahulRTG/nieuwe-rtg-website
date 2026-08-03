# De takenlijst

`LAT.md` verwijst hier op drie plekken naar ("die lijst staat in de
takenlijst, niet in iemands hoofd", en pleisters staan "met naam in de
takenlijst met de oorzaak erbij") -- maar het bestand bestond niet. Dat is
het eerste wat hier opgelost is: de lat leunde op een handhaver die er niet
was.

**Wat hier hoort te staan:** alles wat we WETEN dat het nog moet, met per
regel hoe je vaststelt dat hij af is. Geen wensen, geen ideeen; die horen in
`docs/`. Een regel verdwijnt hier pas als de controle ernaast groen is.

**Wat hier NIET hoort:** "beter maken" zonder maat. Als je niet kunt
opschrijven hoe je ziet dat het klaar is, is het nog geen taak.

Bijgewerkt: 2026-08-03.

---

## 1. Blokkerend voor go-live

Deze acht komen uit `npm run golive`, de eigen keuring van dit huis. Zolang
er hier iets openstaat geeft die keuring exitcode 1.

| # | Wat | Waarom het blokkeert | Klaar als |
|---|---|---|---|
| 1.1 | `RTG_ENC_KEY` zetten | Zonder sleutel staat alles onversleuteld op schijf | `npm run golive` noemt hem niet meer |
| 1.2 | `RTG_VAULT_KEY` uit een secrets manager | Anders ligt de sleutel van de identiteitskluis (namen, e-mail, telefoon) naast de database: wie de datamap steelt heeft ook de sleutel | idem |
| 1.3 | `RTG_SECRET_KEY` uit een secrets manager | Zelfde probleem voor de ondertekening van sessietokens | idem |
| 1.4 | `RTG_OWNER_EMAIL` zetten | In productie geldt de ingebouwde standaard niet | idem |
| 1.5 | `STRIPE_SECRET_KEY` zetten | **De gevaarlijkste.** Zonder sleutel draait de demo-provider die ELKE betaling zelf bevestigt: facturen gaan op "betaald" zonder afrekening, terwijl de RTF-afdracht wel wordt geboekt. Bewust zonder betalingen draaien kan met `STRIPE_DEMO_BEWUST=1` | idem |
| 1.6 | Verwerkingsregister afmaken (AVG art. 30) | 15 open plekken in `VERWERKINGSREGISTER.md` | `npm run golive` telt 0 open plekken |
| 1.7 | Datalek-draaiboek afmaken (art. 33, 72-uursklok) | 4 open plekken in `DATALEK.md` | idem |
| 1.8 | De 18 juridische vragen beantwoorden | Begint bij "onder welke juridische naam draait RTG, en wat is het KvK-nummer?". Rahul kan ze uitvragen op de technische pagina; met de hand typen hoeft niet | `npm run papierwerk` meldt 0 open |

## 2. Sterk aangeraden voor go-live

Geen blokkade, wel een risico dat je bewust moet nemen.

| # | Wat | Waarom |
|---|---|---|
| 2.1 | `ERR_WEBHOOK_URL` zetten en beproeven | Nu is er geen EXTERNE alarmering: een storing zie je alleen als je zelf kijkt, en niet als de doos plat ligt |
| 2.2 | `OFFICE_TOTP_SECRET` zetten | De backoffice heeft nu geen tweede factor, terwijl daar de pasbesluiten vallen |
| 2.3 | `DATABASE_URL` (PostgreSQL) | Op SQLite kan er maar een instance zijn; het transactiegrootboek draait alleen in de sqlite- en postgres-stand |
| 2.4 | `REDIS_URL` | Realtime werkt nu alleen binnen een proces |
| 2.5 | SMTP instellen | Herstel-links en bevestigingen worden nu niet echt verstuurd |
| 2.6 | `RTF_IBAN` vullen | De 30%-afdracht wordt geboekt en gereserveerd ("te_storten") maar niet uitbetaald |
| 2.7 | `APP_URL` zetten | Links in e-mails vallen nu terug op de Host-header |
| 2.8 | `NODE_ENV=production` bij de echte start | Staat nu leeg |

## 3. Buiten de code, op de server

| # | Wat |
|---|---|
| 3.1 | TLS-terminatie voor de app (reverse proxy of load balancer); `trust proxy` staat al aan |
| 3.2 | Rand-DDoS: DNS achter Cloudflare of gelijkwaardig met proxy aan; de app-WAF is de tweede linie |
| 3.3 | **Een onafhankelijke pentest.** Eigen toetsen vervangen geen vreemde ogen, en dit huis toetst zichzelf streng genoeg om dat te weten |
| 3.4 | Herstelproef draaien op de echte machine: `npm test -- test/herstelproef.test.js` zet een backup echt terug |

## 4. Bekende defecten en open eindjes

| # | Wat | Klaar als |
|---|---|---|
| ~~4.1~~ | ~~**De pas-toekenning is nooit doorlopen.**~~ Opgelost in `test/ledenladder.test.js`: aanvraag ingelogd, geen besluit zonder backoffice-mens, besluit door `kantoorAlsPersoon`, opnieuw inloggen, tier `lifestyle`, en dan alle twaalf apps plus de adviseur open en werkend. Wat de drie eerdere pogingen misten: de aanvraag moet MET de sessie van het lid binnenkomen, anders heeft hij geen `accountId` en tilt `setTier` niemand op. Beide dragende beweringen (de poort `eis()` en `accounts.setTier`) zijn met een mutatie RAAK bevonden | — |
| 4.2 | `test/leven.e2e.js` is rood: 13 schermen geven "geen teken van leven". Bestaand, niet van vandaag; de nulmeting gaf er 20 | de toets is groen, of de schermen die legitiem geen API aanroepen (kaart, camera, feed, juridische tekst) staan met reden op de uitzonderingslijst |
| 4.3 | 622 endpoints (25%) zonder toets volgens de TEKSTmeter. Die overdrijft: een toets die zijn pad samenstelt (`rh('cellier/zet')`) telt als ongetest, zodat de hele Rechterhand-suite als gat meetelt terwijl hij echt draait. De waargenomen meting staat op 100% aangeraakt. Wat na aftrek van beide overblijft is de eerlijke vraag: is het GEDRAG vastgelegd, of alleen de status | `endpointsZonderTest` daalt zonder dat er paden zijn uitgeschreven om de meter te plezieren; de rangschikking naar risico is leidend, niet het getal |
| 4.4 | `docs/apps-volwaardig.md` is gebouwd op een kapotte meting: hij telt letterlijke `/api/`-paden en mist elke aanroep via een hulpje (`api('cercle')`). Daardoor staan er 35 "schillen" waar er 4 zijn, en 1 volwaardige app waar er 20 zijn | het document is herschreven met de meting die ook hulproepen telt |
| 4.5 | Functies achter een schakelaar: `bank.html` toont "Binnenkort" | bewust besluit per functie welke bij lancering aanstaan, vastgelegd in de boardroom |
| 4.6 | `scripts/ast-scan.js` komt lokaal in 9+ minuten niet rond, terwijl hij in CI een blokkerende stap is | de scan rondt in een acceptabele tijd, of hij draait alleen op gewijzigde bestanden |
| 4.7 | De json- en geheugen-opslagstand hebben geen transactiegrootboek; `bewaarStaart` is daar een pleister (LAT-regel 1, met naam genoemd) | het grootboek werkt in alle standen, of de standen zonder grootboek zijn in productie geblokkeerd (dat laatste doet `server/config/productie-opslag.js` al) |
| 4.8 | **Zestien van de drieentwintig meters zijn ongeijkt**: ze staan in `test/meterijk.test.js` met een opgeschreven reden in plaats van een proef die ze op een bekend-foute invoer laat uitslaan. Zes daarvan zijn prestatiecijfers (die komen uit een beproeving van een half uur op een echte machine), tien vragen een repo-brede staat of een heel testjournaal in plaats van een invoer die je in een toets neerzet. Dat is geen defect maar een schuld, en hij staat nu op de teller: `metersOngeijkt` in `NORM.json` mag alleen omlaag | `metersOngeijkt` daalt onder de 16; de tien niet-prestatiemeters zijn de eerste kandidaten, want die zijn met een echt (tijdelijk) bestand wel te voeden |
| 4.9 | **105 van de 188 apps hebben geen eigen schermtoets.** `scripts/schermen.js` telt sinds deze ronde de apps waar geen enkele toets de weg werkelijk aflegt: nooit geopend, of alleen even aangetikt door een veegtoets (`leven.e2e.js` loopt alle schermen langs voor een teken van leven, en dat is geen bewijs dat de app doet wat hij belooft). Dit is de machinale kant van "af is niet iemands woord"; het getal staat als `schermenZonderToets` in `NORM.json` en mag alleen omlaag | het getal daalt gestaag; begin bij de apps waar geld, toegang of identiteit langskomt, want daar is "het ziet er compleet uit" het duurst. De nulmeting is op een stilliggende boom overgedaan en gaf hetzelfde getal, dus die staat |

## 5. Lopend werk

| # | Wat | Stand |
|---|---|---|
| 5.1 | Premium-laag (meenemen + sneltoetsen) over alle apps | **Afgerond: 170 van de 188 schermen**, gemeten op de boom. De 18 zonder zijn alle 18 bewust zonder, met reden: negen RTF-kinderapps en `index.html` (spel en startscherm, geen register om mee te nemen), vier juridische tekstpagina's plus `juridisch.html` (lopende tekst), `horloge.html` en `uitzicht.html` (vaste opmaak, geen lijst en geen zoekveld, dus beide lagen zouden niets vinden), en `kantoorpda.html` plus `zorgbalie.html` -- dat zijn geen apps maar doorverwijsstubs met een meta-refresh naar `personeel.html` (zie 5.5) |
| 5.2 | Deelmenu over alle apps | 69 apps met menu, 85 bewust zonder (spellen, camera, feeds, chats), afgerond |
| 5.3 | De deur voor gesloten apps | 58 apps afgerond (14 pas, 3 personeel, 41 gezin) |
| 5.4 | 35 apps stonden bij de deelmenu-uitrol als "kandidaat vervolg" omdat ze hun scherm pas na een fetch bouwen; het component kan dat inmiddels | opnieuw langslopen nadat 5.1 klaar is |
| 5.5 | **Tien kantoor-apps sturen uitgelogd weg** naar `personeel.html?kantoor=1` in plaats van de deur te tonen (lab, kantoren, architect-pda, hardware-pda, kantoorpda en vijf andere). Dat is hetzelfde patroon dat bij de eenenveertig RTF-gezinsapps al is opgelost: je verliest waar je heen wilde. Gevonden doordat het verificatieharnas op lab.html bleef hangen | de deur toont zich op de app zelf, met de weg naar de personeels-inlog erin; net als bij `Sessie.deur('gezin')` |

## 6. Eerlijkheidspunten

Dingen die ik niet zelf heb kunnen natrekken. Ze staan hier zodat niemand
ze voor bewezen aanziet.

| # | Wat |
|---|---|
| 6.1 | `test/klankwerk.e2e.js` is geschreven door een uitrol-agent. Hij draait groen, maar ik heb zijn beweringen niet met een eigen mutatie natrokken (LAT-regel 2). Staat ook zo in `NORM.json` |
| 6.2 | Bij de subtree-wacht van `shared/deelmenu.js` sloeg de mutatie AF: de toets bleef groen omdat `desktopframe.js` toevallig `main` aanraakt en de wacht zo alsnog wekt. De reparatie staat er terecht, maar deze toets bewijst dat punt niet |
| ~~6.3~~ | ~~Ik heb nooit achter de Lifestyle-poort gekeken (zie 4.1).~~ Opgelost: `test/ledenladder.test.js` loopt de ladder af en schrijft in alle twaalf apps een regel die daarna ook echt teruggelezen wordt. Wat er nog steeds niet is: dezelfde weg door het SCHERM (de twaalf app-pagina's zelf), alleen door de API |
| 6.4 | Een tussenstand-commit tijdens een lopende agent-ronde nam een mutatie-restant mee (`if (1) return null; // MUTATIE` in `foundation/geld.html`), waardoor die ene app stil zijn gegevens niet kon meenemen. Opgelost in `c0ed900`; sindsdien gaat elke tussenstand eerst langs de diff |
