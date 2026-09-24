# MONEY-012 — één financiële waarheid na elke onderbreking

Status: **deels bewezen, niet gesloten.** Opgesteld 24 september 2026.
`docs/rtg-2030.md` §9 noemt MONEY-012 een zelfstandige P0 die de release
tegenhoudt. Tot deze ronde bestond de naam alleen; dit document legt vast wat hij
eist, wat er vandaag bewezen is, en wat nog openstaat.

## De eis

Een financiële handeling eindigt na elke ondersteunde onderbreking in precies één
verklaarbare financiële waarheid. Settlement, reconciliatie en grootboek kunnen
elkaar niet tegenspreken. Vier wetten:

1. **Behoud.** Er ontstaat of verdwijnt geen onverklaard geld.
2. **Eén gevolg, niet één transport.** Verzoeken en gebeurtenissen mogen dubbel
   aankomen, maar het financiële gevolg verdubbelt nooit.
3. **Herstel convergeert.** Na een crash, time-out, verloren antwoord of
   onderbreking bij de provider komt herstel uit op dezelfde canonieke toestand.
4. **Afstemming gaat voor.** Zegt de provider iets anders dan RTG, dan neemt RTG
   nooit stil aan dat het klopt. Het verschil wordt vastgesteld en afgehandeld.

Een uitkomst "onbekend, wacht op uitspraak van de rail" voldoet aan de eis. Een
schijnsucces of een schijnmislukking voldoet niet.

## Wat deze ronde vond en repareerde

De proef liep door de bestaande keten: de betaalopdracht
(`server/kern/betaalopdracht/`) en de uitbetaalnaad (`server/betaal.js`). Er
kwam geen nieuwe geldlaag bij. Hij vond twee gaten, allebei op het enige pad
waar geld het huis echt verlaat, en allebei een schending van wet 1.

1. **Terugboeken op een onbekende uitkomst.** Een opdracht werd na de laatste
   mislukte poging MISLUKT en daarna teruggeboekt, ongeacht wat de fout was. Bij
   een time-out of verbroken verbinding *na* verzending kan de rail het geld
   echter al hebben uitbetaald. Het lid kreeg het bedrag dan terug terwijl de
   ontvanger het ook had: geld uit niets.
2. **Terugboeken na aanname.** Een opdracht die de rail al had aangenomen
   (INGEDIEND) gaat elke ronde opnieuw langs de rail. Zette het kantoor de rail
   daarna uit, dan gooiden de herhalingen een fout en werd de opdracht na zes
   pogingen alsnog teruggeboekt, terwijl het geld al onderweg was.

**De reparatie is klein.**
- Een fout die aantoonbaar vóór verzending valt, draagt `nietVerstuurd`
  (`voorDeDeur()` in `server/betaal.js`). Alleen zo'n fout mag nog tot opgeven en
  terugboeken leiden.
- Elke andere fout, en elke fout op een opdracht die de rail al had aangenomen,
  zet `misschienVerstuurd`. Na de laatste poging gaat de opdracht dan naar de
  nieuwe stand **ONBEKEND**.
- ONBEKEND telt mee in de reconciliatie (`onbekend`, `onbekendeCenten`, en op het
  bankbord `railOnbekend`). De automatische ronde pakt hem niet op.
- Uit ONBEKEND kom je alleen via een uitspraak van de rail: een herinzending met
  dezelfde sleutel (INGEDIEND of AFGEWIKKELD), of een bevestigde mislukking
  (MISLUKT, dan teruggeboekt). Tijd alleen is geen uitspraak.
- De voorzichtige kant is de standaard: een fout zonder merk telt als "misschien
  verstuurd". Wie later een echte netwerkrail aansluit, krijgt vanzelf dat
  gedrag.

## ONBEKEND is een tussenstand: de afstemming

ONBEKEND zet het geld vast, zodat het niet dubbel uitgaat. Zonder uitweg zou hij
het voor altijd vastzetten. `kern/betaalopdracht/afstemming.js` sluit een
ONBEKENDE opdracht op de uitspraak van de rail, met drie uitkomsten:

| Uitspraak van de rail | Uitkomst | Wat er met het geld gebeurt |
|---|---|---|
| uitgevoerd, dit bedrag, deze valuta | **BEVESTIGD** | AFGEWIKKELD, geen teruggang |
| niet uitgevoerd | **NIET_UITGEVOERD** | MISLUKT, precies één keer teruggeboekt |
| uitgevoerd, ander bedrag of andere valuta | **VERSCHIL** | niets: de opdracht blijft ONBEKEND en krijgt een verschilzaak met verwacht naast gezien |

Een verschil wordt nooit afgerond of stil gecorrigeerd. Een latere, kloppende
uitspraak sluit hem, en het verschil blijft in het spoor staan (`opgelostAt`).

**Bewijs dat niet uit een formulier komt.** De echtheid is `CRYPTOGRAPHIC` (een
ondertekend bericht), `DIRECT_API` (een antwoord op onze eigen vraag) of
`OVERGENOMEN`. Dat laatste is een afschriftregel die een kantoormens overneemt
via `POST /api/office/bank/opdrachten/afstemming`. Een tweede mens tekent die
aanvraag af via de bestaande tweede-handtekeningdeur (besluit van de eigenaar,
24 september 2026: beide wegen, met vier ogen). De route zet die echtheid zelf;
het formulier kan hem niet opgeven.

**Waarom niet `economie/runtime/reconciliatie.js`.** Die legt een settlement die
al bevestigd is naast een afschriftregel: klopt wat de provider zei? Hier is de
vraag een stap eerder: wat heeft de provider gedaan? Aansluiten zou de bank-SEPA
en de partneruitbetaling naar het intent/claim-model verhuizen. De vorm is wel
overgenomen: alleen geauthenticeerd bewijs, en een afwijking wordt een zaak.

## De inkomende kant: één waarheid voor geld dat binnenkomt

Opladen (`kern/pay/opladen.js`), facturen (`routes/member/betalen.js`) en directe
betalingen aan een partner (`kern/directpay/betalen.js`) riepen elk een kale
`betaal.maakBetaling` aan. Daarmee zaten er drie gaten in:
- **Een wisselende sleutel.** Zonder `idem` was de providersleutel van opladen
  bij elke poging anders. Een herhaling na een verloren antwoord belastte de kaart
  dan twee keer.
- **Niets vastgelegd bij een fout.** De eerste betaling werd nooit bijgeschreven,
  en niemand wist dat hij bestond.
- **`kaartWachtend`.** Een wachtende betaling ging daarheen, zonder veegronde en
  met een **stille wis** van de oudste rijen boven de 20.000.

Alle drie de paden lopen nu via de bestaande eigenaar, `kern/betaalwaarheid/`
(besluit van de eigenaar, 24 september 2026: alle drie tegelijk). Er komt geen
tweede providerwaarheid bij:
- **Vastleggen vóór de aanroep, met vaste sleutel en vaste aanbieder.** De
  betaling staat vast vóór de externe aanroep, met een vaste sleutel. De
  startopties (`r.start`) gaan mee de boeken in, zodat een hervatting dezelfde
  aanbieder gebruikt.
- **De veegronde** (`kern/betaalwaarheid/hervat.js`, op de bestaande
  onderhoudsklok). Die vraagt na wat geen uitsluitsel gaf: een betaling zonder
  referentie (`onbekend`), of een betaling die wacht. Dat gebeurt met dezelfde
  sleutel, dus het is een opzoeking en geen tweede betaling. Na zes hervattingen
  volgt een **ESCALATIE** voor een mens; de stand blijft staan en er wordt niets
  gewist. Een betaling die nooit is aangeboden, start de veegronde niet zelf.
- **Precies één keer bijschrijven.** Voor opladen gebeurt dat in
  `kern/pay/oplaadwaarheid.js`. Het bewijs daarvan staat in dezelfde opslag als de
  boeking, en in motorstand ontdubbelt de motor op de economische sleutel.
  Facturen en directe betalingen gaan via `kern/betaalwaarheid/inkomend.js` door
  dezelfde `settleFactuur`, die al per betaal-id ontdubbelt.
- **De factuurroute schrijft de ledenstaat niet meer.** `getMemberState` geeft
  een kopie, en een save van die oude kopie zou "betaald" overschrijven. De
  reisonderdelen van een factuur gaan mee in de afwikkeling. Voorheen deed alleen
  de route dat, en de webhook nooit.
- **Geen nieuwe schrijvers in `kaartWachtend`.** De webhook leest daar alleen nog
  oude rijen uit.
- **De gastbetaling** laat haar betaalslot staan na een uitkomst zonder
  uitsluitsel. Anders betaalt de gast met een nieuwe sleutel opnieuw.
- **De simulatiebank** heeft een eigen stand in `betaalwaarheid/staten.js`. Zonder
  die stand viel ook `geweigerd` op IN_BEHANDELING en wachtte hij eeuwig.

## Welke proef welke wet dekt

| Wet | Uitgaand (betaalopdracht) | Inkomend (betaalwaarheid) |
|---|---|---|
| 1 Behoud | `test/money012.test.js`: alle 64 storingsvolgordes, nooit uitgevoerd én teruggeboekt, en na afstemming precies één van beide | `test/money012-inkomend.test.js`: alle 64 volgordes, hooguit één belasting, nooit bijgeschreven zonder belasting; verder `geld-conservatie-last` en `magnaat-rtgketen` (nul verschil) |
| 2 Eén gevolg | idem: één sleutel per opdracht, hooguit één uitvoering en één teruggang | idem: één sleutel, dezelfde aanbieder ook na een herstart, één bijschrijving ook als de afhandeling na een storing herhaald wordt (met tegenproef); verder `betaalwebhook-fouten` en `betaalstore` |
| 3 Herstel | idem, alle 64 volgordes ook met een herstart na elke stap (de rij door JSON, zoals op schijf) | idem, elke volgorde eindigt op BEVESTIGD met één bijschrijving zodra de provider zich uitspreekt, ook met een herstart na elke ronde |
| 4 Afstemming | ONBEKEND is zichtbaar in de reconciliatie; alle 64 volgordes sluiten ook via de afschriftweg; BEVESTIGD, NIET_UITGEVOERD en VERSCHIL (bedrag én valuta) elk apart; zonder echtheid of bron geen afstemming; de route maakt geen aanvraag voor een opdracht die niet ONBEKEND is | `onbekend` telt mee in `openstaand()`; na zes hervattingen ESCALATIE en de betaling blijft staan; `betaalwaarheid` (bedrag wijkt af → CONTROLE_NODIG) |

De meter kan uitslaan. De tegenproef laat de rail een verloren antwoord als "niet
verstuurd" melden (het oude gedrag), en dan vindt de sweep geld uit niets. Vier
mutaties op de reparatie laten de juiste toetsen zakken. Een vijfde bleef groen
en wees een overbodige tak aan; die is verwijderd.

## De eindproef

`test/money012-keten.test.js` draait de echte keten in één proces en toetst geen
losse modules:
1. `pay.laadOp`, gevolgd door de betaalwaarheid;
2. `server/betaal.js` met de simulatiebank;
3. een storingslaag: het antwoord raakt kwijt, of de aanroep valt om vóór de rail;
4. herstarts, waarbij de opslag door JSON gaat;
5. de veegronde;
6. de afhandelaar;
7. het grootboek.

De volgordes: 27 storingsvolgordes, telkens met en zonder herstart en met en
zonder een klant die opnieuw drukt. Na elke volgorde gelden deze vier eisen:
- de rail heeft precies één keer uitgevoerd;
- de wallet staat op precies het bedrag;
- het grootboek sluit;
- er staat niets open, niets onbekend en niets geëscaleerd.

Antwoordt de rail nooit, dan is er niets belast en niets bijgeschreven, sluit het
grootboek, en staat de betaling geëscaleerd en eerlijk `onbekend`. Een tegenproef
met de oude weg laat een dubbele belasting zien, en twee mutaties op de echte
keten laten de eindproef zakken.

**De einddefinitie van MONEY-012:** *een crash, retry, time-out of onbekende
provideruitkomst mag de financiële waarheid niet veranderen.* De uitgaande kant
bewijst dat met `test/money012.test.js`, de inkomende kant met
`test/money012-inkomend.test.js`, en de keten als geheel met
`test/money012-keten.test.js`.

**Bevriezen.** Zodra deze drie proeven in CI groen zijn, geldt MONEY-012 als
gesloten voor wat de repo kan bewijzen. Hij gaat dan alleen weer open op een
*aangetoonde* breuk van een van de vier wetten, niet op een nieuw bedacht
scenario. Wat alleen met echte providers te bewijzen is, staat hieronder als
extern bewijs en blokkeert de sluiting van het repobewijs niet.

## Wat nog openstaat

MONEY-012 is pas gesloten als deze punten dicht zijn of met reden uitgesloten.

- **Afschrift ophalen en het Pay-bewijsbord.** Een ONBEKENDE uitbetaling kan nu
  worden afgesloten. Het afschrift *ophalen* bestaat nog niet: er is geen echte
  uitbetaalrail en geen statusvraag (`haalUitbetaling`). `kern/pay/bewijs.js`
  `afstemming()` leest `payAfstemming`, maar niets schrijft dat, dus die controle
  staat nog altijd op `niet-bewezen`. Die gaat over het Pay-grootboek (de
  inkomende kant) en hoort bij het volgende punt.
- **De ondertekende webhook als afstemkanaal.** Een payout-webhook vindt zijn
  opdracht op de referentie van de rail. Bij een verloren antwoord kent RTG die
  referentie niet, dus zo'n opdracht sluit vandaag via een herinzending of via de
  afschriftweg, en niet via de webhook.
- **Het kantoorbord.** Het bord toont ONBEKEND en het aantal verschilzaken
  (`railVerschil`). Een formulier voor de afstemming staat er nog niet: de route
  wordt vandaag rechtstreeks aangeroepen.
- **Oude rijen in `kaartWachtend`.** Nieuwe rijen komen er niet meer bij. Rijen
  van vóór deze ronde worden nog door de webhook afgewikkeld, maar hebben geen
  veegronde. Een eenmalige overzetting naar de betaalwaarheid vraagt een besluit:
  een oude rij draagt geen sleutel waarmee de provider hem terugvindt.
- **Het inkomende overzicht op een scherm.** `betaalWaarheid.openstaand()` telt
  `onbekend` en `escalatie`, maar geen kantoorscherm toont het nog.
- **In een draaiende server.** Een verloren antwoord valt daar niet uit te
  lokken: de verraadsmotor heeft geen providerstand (`traag-antwoord` staat op
  `waar: null`). Deze ronde bewijst de beslissing in de rij en de merktekens in
  de naad. De draaiende keten met een verloren antwoord is niet bewezen.
- **De geldmotor.** Een time-out van de motor (502) herstelt via de economische
  sleutel en `reconcileVanMotor`. Dat wordt hier niet opnieuw beproefd.
- **Echte providers.** Het externe dossier (`deploy/external-release.example.json`:
  `refundPayoutSettlement`, `reconciliation`, `webhookDelivery`) blijft buiten de
  repo en blijft `OPEN` tot er echt bewijs is.

Pas als deze lijst leeg is, hoort dit bewijs een releasepoort te worden.
