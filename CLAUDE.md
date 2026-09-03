# Rahul Travel Group — Projectcontext voor Claude Code

Dit bestand wordt automatisch gelezen bij elke Claude Code-sessie in deze map.

## Wat dit project is

Website + ledenportaal + app (PWA) voor Rahul Travel Group (RTG) — een membership-reisbureau met drie passen (RTG Pass, Lifestyle Pass, Business Pass), een partnerkanaal voor niet-leden, De Salon (besloten sociaal netwerk), en een RTFoundation die 30% van de bijdragen naar liefdadigheid brengt.

**`README.md` is de actuele technische documentatie** (structuur, starten, API-overzicht, PWA, partnerkanaal) — lees die eerst bij technische vragen. Dit CLAUDE.md bevat vooral de merkregels en afspraken die niet uit de code af te leiden zijn.

**`PLATFORM.md` bevat de super-app-regel** — lees die vóór je apps samenvoegt of
een nieuwe app aanmaakt. In één zin: super apps vervangen geen domeinsoftware,
ze orkestreren die; alleen apps die dezelfde kern, data én workflow dupliceren
mogen samensmelten. De toetsvraag is niet "kan dit in een super-app?" maar "is
dit een zelfstandige capability, of een tweede ingang naar dezelfde?". Daar
staat ook **het wereldpatroon**: samenvoegen is stap een, niet de bedoeling —
een wereld is pas af als hij zijn onderwerp begrijpt (graaf, beleid, cockpit,
gegronde Rahul, actielog).

**`GELD.md`, `LEVEN.md` en `LIFE.md` zijn de diepte-documenten per wereld.** GELD.md
maakt van RTG Geld een financieel besturingssysteem; de harde grens daar is
dat geld het huis nooit vanzelf verlaat. LEVEN.md maakt van RTFoundation een
Life OS dat een mens vanaf de geboorte begeleidt — lees vóór je daaraan werkt
vooral paragraaf 2, de grenzen: een kind is geen profiel, nooit sturen maar
openen, en de bijdrage-spiegel is nooit vergelijkend. Waar een functie botst
met een grens, vervalt de functie. LIFE.md maakt van RTG Sociaal een Life OS:
niet een sociaal netwerk maar het leven tússen mensen, waarbij een lid geen app
opent maar een levensmoment. Het werkwoord daar is **samenstellen en klaarzetten
— bevestigen doet de mens**: alles wat een tweede persoon bereikt (uitnodiging,
bericht, boeking, betaling) wordt nooit automatisch. Lees ook daar paragraaf 4,
de grenzen: een relatie is geen trechter, en er komt geen score op het leven
tussen mensen.

**`REIZEN.md` is het diepte-document van RTG Reizen** — het Travel OS: niet een
reisbureau met een boekingssite, maar een wereld die reizen beheert, ook de reis
die RTG niet verkocht heeft. Het werkwoord daar is **vóór zijn**: opmerken en
klaarzetten voordat de reiziger het merkt, en uitvoeren alleen waar het domein
dat al mocht. De zin die het ontwerp stuurt: het maakt niet uit waar een
onderdeel vandaan komt, het maakt wel uit dat RTG dat weet — vandaar dat elk
reisonderdeel een **soort** (wat de reiziger ziet) én een **herkomst** (wat het
systeem weet) draagt. Lees vóór je hieraan werkt vooral paragraaf 2.1 en de
grenzen: de Reis bezit geen boeking maar een verwijzing, een voornemen en een
bewijs; een wachter zonder bron zegt dat hij niet kijkt; een ingelezen waarde
wordt nooit stilletjes verbeterd, en de barcode blijft van de uitgever.
**`FOUNDATION.md` is het diepte-document van de RTFoundation als platform** —
Personal & Civic Operating System, op drie niveaus tegelijk: individu,
professional, organisatie. Het doet LEVEN.md niet over (dat blijft gelden en gaat
over de mens zelf) maar voegt de civiele helft toe: zaken over meerdere
instanties, documenten die iets van iemand vragen, processen met een
doorlooptijd, en het bewijs eronder. Lees vóór je hieraan werkt vooral
paragraaf 2, het werkwoord: **de Foundation opent en zet klaar — bevestigen doet
de mens**, en uitvoeren richting een instantie doet zij nooit zelf. Er is bewust
geen `EXECUTE_LOW_RISK`: wie bouwt weet niet in wiens leven hij staat, en een
grens die per geval anders had gemoeten is geen grens. Paragraaf 5 heeft zeven
eigen grenzen bovenop die van LEVEN.md; de scherpste twee zijn dat een
eligibility-motor alleen mag tóevoegen (nooit "dit is niets voor jou") en dat de
meeteenheid van een capaciteitsmotor de taak is en nooit de mens. Paragraaf 7
zet vijftig voorgestelde onderdelen op een rij met per stuk of hij al bestaat en
welke grens hem eerlijk houdt.
**`HDI.md` is de laag BOVEN de Foundation** — RTG Human Development
Infrastructure, als richtingsdocument met per onderdeel of het **staat**, **een
stap weg** is, **een besluit vraagt** of **jaren weg** is (zoals PLATFORM.md en
ECONOMIE.md). Lees die vóór je aan kwetsbare doelgroepen, veiligheidszaken of
ontwikkeltrajecten werkt. De missie: *niemand mag uit beeld verdwijnen omdat
zorg, gemeente, corporatie, werkgever, politie, onderwijs en stichting ieder maar
één stukje van die persoon zien.* De fundamentele eenheid schuift van de casus
naar de mens — **en precies daarom mag die mens nergens als rij bestaan**: par.
5.1 is de grens waar het hele project op staat of valt, en de uitweg is de vorm
die `kern/levensgraaf/graaf.js` al gevonden heeft (een PROJECTIE, geen tweede
database, met `deel` als poort en niet als etiket). Er komt dus geen
`humans`-tabel, en geen route die "alles over deze mens" teruggeeft zonder dat de
mens zelf die aanroep doet. Par. 1 is de meting die het document eerlijk houdt:
van de acht voorgestelde lagen staan er vijf al onder een andere naam
(`kern/levensgraaf/` is de development graph, `kern/livinglab/graden.js` de
causale motor met drie plafonds waarvan het laagste wint, `kern/rtfos/gemeente.js`
de outcomes ledger die telt zonder te lezen) — dus het werk is aansluiten en niet
uitvinden. Par. 2 houdt vier namen tegen die al bezet zijn (**capability** is
platformvermogen in OS.md, **wallet** is geld in WAARDE.md, en `NIVEAUS` en
`FASEN` dragen er al 9 en 8 betekenissen). Vier grenzen die niet mogen sneuvelen:
veiligheidsgegevens zijn een andere DATAKLASSE en geen gevoeliger veld (geen
partnerkoppeling, geen adresveld, geen export, geen standaard bewaartermijn), de
meeteenheid is nooit de mens (een voortgangsmaat mag over een cohort en nooit per
persoon, ook niet intern als sorteersleutel), een solver toont altijd meer dan
één pad en zegt nooit "dit is niets voor jou", en **duress mode wordt heel of
niet gebouwd** — een webapp kan de app-switcher, de notificaties en de
browsergeschiedenis niet garanderen, dus wat er niet verborgen kan worden staat
er hardop bij. De Personal AI Advocate wacht op een getal en niet op een gevoel:
`VERTROUWEN.json` staat op 0 bewezen en 4180 verzwakt, dus hij komt er eerst als
LEZER op `levensgraaf/termijnen.js`. Par. 7 zet de volgorde vast, en de eerste
twee regels (uitstapknop, hulpwijzer verbreden) kosten samen twee dagen en doen
meer voor de mens uit de missie dan de acht eronder.

**`ONTMOETEN.md` is het diepte-document van de twee datingapps** — Vonk en
Rendez-vous, en vooral waarom het er twee zijn en geen drie. In één zin: **Vonk
zoekt de juiste mensen, Rendez-vous maakt de juiste ontmoeting** — bij Vonk is de
match het product, bij Rendez-vous de ontmoeting. De toetsvraag bij elke nieuwe
functie is dus: maakt dit het vínden beter of het ontmóéten? Lees vóór je aan
daten, matchen of introduceren werkt vooral paragraaf 4, de grenzen: de software
port nooit aan tot een volgende stap (de knop mag, de aansporing niet), een
introductie leunt nooit op een derde, aanwezigheid is zelf opgegeven en nooit
afgeleid uit RTG Travel, en er komt geen cijfer op een mens — ook niet intern als
sorteersleutel. De poort (18+ met geverifieerd paspoort) staat op één plek,
`server/kern/ontmoetpoort.js`, en wordt door beide apps gedeeld; de pas-eis is
iets anders en blijft op de route. Par. 4 van `LIFE.md` staat er onverkort boven.
**`TOKEN.md` gaat over de geldvorm zelf** — wat een eigen betaaltoken hier mag
zijn. De kern in één zin: RTG heeft er al een, hij heet RTG Pay, en de vraag is
niet of we er een bouwen maar of we hem uit het gesloten circuit halen. Dat is
namelijk de grens tussen een besluit (`WALLET_SALDO` in
`kern/bevoegdheid/lijst.js`: gesloten circuit, harde plafonds, niet uitbetaald
aan het lid) en een vergunning (`GELD_UITGEVEN`, en daar staat geen partnerrail
naast). Lees vóór je aan tegoed, punten of munten werkt vooral paragraaf 5 en 7:
wat er bewust niet komt (een eigen chain, crypto eruit, een koers, tegoed dat
verjaart ten gunste van RTG) en de drie besluiten die openstaan — waarvan de
eerste, de bank-uitgang, vóór de leden-bank opengaat genomen moet worden en
niet erna.
**`WAARDE.md` is de laag onder het geld** — RTG Value: niet wat één lid met zijn
geld doet (dat is GELD.md) maar wat waarde binnen RTG zélf is. De kern in één
zin: elke euro, elk tegoed en elk budget weet wie het bezit, waarvoor het
gebruikt mag worden, wie het mag verplaatsen en welk bewijs daarvoor bestaat.
Lees die vóór je aan saldo, tegoeden, vouchers, budgetten of uitbetalen werkt.
Zes waardeklassen met elk een **grond** (`kern/waarde/klassen.js`), drie
beleidslagen van hard naar zacht (`kern/waarde/policy.js`), en één poort waar
elke betaling langs gaat (`kern/pay/poort.js`). Twee manieren waarop geld
vaststaat en ze zijn met opzet niet hetzelfde: een **reservering** is iemand
anders die uw geld vasthoudt en die vervalt (`kern/waarde/reserve.js`), een
**oormerk** is u die uw eigen geld apart zet en dat blijft
(`kern/waarde/oormerk.js`). Verder: budgetten van een werkgever of gemeente als
eigen positie, slim betalen uit meerdere potjes waarbij het meest beperkte potje
eerst opgaat, een eigen geldgrens die wél weigert (`kern/geldbeleid/grens.js`),
treasury voor ondernemers, een terugstorting naar de eigen bankrekening
(`kern/pay/terug.js`), en een bewijsbord dat drie standen kent en géén groen
(`kern/pay/bewijs.js`). Vier grenzen die niet mogen sneuvelen: er komt geen
tweede boekhouding bij, **uitbetaalbaar hangt altijd aan een bevoegdheid en
nooit aan een boolean** (elke uitbetaalbare klasse noemt haar
`uitbetaalVermogen`), het plafond per wallet is een grond en geen instelling, en
de AI beweegt geen geld. Waarom "voucher" het verkeerde woord was, staat in
paragraaf 1: transactiekosten verdwijnen niet, ze verhuizen naar het
oplaadmoment — en dát is het echte voordeel.

**`ECONOMIE.md` is de laag erboven** -- RTG Economic Control Plane: de financiële
intelligentielaag van het hele ecosysteem, als richtingsdocument met per onderdeel
of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren weg** is
(zoals PLATFORM.md en DEVELOPERCLOUD.md). Lees die vóór je aan doorbelasten,
werelden of financiële voorspellingen werkt. De kern in één zin: **de RTFoundation
is geen kostenpost van RTG die je over gebruikers uitsmeert, maar een eigen
rechtspersoon met een eigen vermogen** -- en dat wordt afgedwongen en niet
beloofd. Vier economische werelden (`consument`, `commercieel`, `rtg-intern`,
`rtfoundation`) waarvan de wereld een eigenschap is van de IDENTITEIT en niet van
de transactie, met een **firewall** ertussen die standaard weigert
(`kern/economie/firewall.js`): een relatie tussen twee werelden bestaat alleen met
een grondslag én een plafond, het register is standaard leeg, en een weigering
zegt altijd hoe het wel kan. De nota's van de infrastructuur gaan daarom eerst
over de vier werelden en pas daarna binnen elke wereld over haar eigen gebruikers.
Er is een tweede poort die geen relatie kan openen: een rekening landt bij de
ENTITEIT van een wereld, nooit bij een gebruiker ervan -- RTG mag de stichting
factureren, nooit een gezin. Wat er nog niet is (economische graaf, provenance tot
de providerfactuur, periode sluiten, forecast, cost routing) staat in ECONOMIE.md
mét de reden en de stand, niet als lege functie.

**`KOSTEN.md` is de kostprijskant** -- RTG Kostprijs: wat kost elke gebruiker ons,
en wie betaalt dat. WAARDE.md gaat over waarde die BINNEN RTG beweegt; dit gaat
over het geld dat het huis er zelf aan uitgeeft. Lees die vóór je aan tarieven,
verbruik, doorbelasten of "wat kost een gratis account" werkt. De kern in één zin:
**elke euro die dit huis uitgeeft krijgt een eigenaar, of de eerlijke mededeling
dat hij er geen heeft.** Negen kostensoorten (`kern/kosten/soorten.js`) waarvan er
zeven per gebruiker meetbaar zijn en twee niet; stroom en serverhuur worden
verdeeld uit de echte nota met de sleutel erbij en dragen daarom altijd de graad
`vermoed` -- het plafond volgt uit de meetweg en staat níét per regel, want die
tweede plek werd door de toerekening genegeerd. De meter houdt tellers en geen
journaal (een gedragslogboek per lid is voor een factuur niet nodig), de drager
komt uit de async-context die de poort zet (`kern/kosten/haak.js`), en de AI-meter
hangt op de enige plek waar élke modelaanroep langskomt (`server/ai.js`). Drie
grenzen die niet mogen sneuvelen: er staat nooit een getal waar er geen is (geen
tarief of nota = een REDEN, geen nul), deze laag kent geen namen (sessiesleutel,
zaakcode, gezinscode -- nooit de kluis), en de machine zet klaar terwijl een mens
uit de boardroom vrijgeeft. Wie wat betaalt staat in `kern/kosten/beleidkaart.js`:
vier standen, met **RTG Lite en Business Lite er al in en `bestaatNog: false`
erbij**, en met `gezin` en `huis` als beloften die géén schakelaar zijn -- de
RTFoundation blijft gratis voor elk gezin, dat gezin ziet alleen wát het kost
(`/api/foundation/kosten`, alleen de beheerder, en het antwoord opent met de
belofte en niet met het bedrag). **Vier lezers, vier schermen, een antwoord**:
een lid ziet het in RTG Geld (stand *Kosten*), een zaak op
`/apps/zaakkosten.html`, het kantoor op `/apps/kosten.html` -- die drie op
dezelfde gedeelde vormtaal (`public/shared/kostenbeeld.js`), zodat "vermoed" op
het scherm van het lid hetzelfde betekent en er hetzelfde uitziet als op het bord
waar een mens besluit hem de rekening te sturen. Het vierde is het gezin, in het
beheerscherm van de RTFoundation: eigen route, eigen toon, en het opent met de
belofte in plaats van met het bedrag. **Alle negen soorten hebben nu een teller of een
verdeling**: AI en verzoeken via de poorten, berichten via mail én sms (twee
choke points, want er komt een aanroeper rechtstreeks langs `sendSms`), opslag als
STAND die je peilt in plaats van optelt (`kern/kosten/meterstand.js` -- wie een
stand als stroom telt, laat de rekening van wie niets doet het hardst groeien), en
transactiekosten op het oplaadmoment. Daarbovenop: de herkomstketen tot de
leveranciersfactuur (`kern/kosten/herkomst.js`, en die eindigt eerlijk bij "zo is
hij overgenomen door een mens"), de maandafsluiting waarin een maand pas dichtgaat
als elk verschil een verklaring draagt en een maand **in onderzoek** nooit naar een
rekening gaat (`kern/kosten/periode.js`), een vooruitblik waarvan de bandbreedte
pas verschijnt als de trefzekerheid over drie afgesloten maanden GEMETEN is
(`kern/kosten/vooruitblik.js`), en een verbruiksgrens die de AI-weg werkelijk
dichtzet terwijl de rest van de app in de regelgestuurde werkmodus doorloopt
(`kern/kosten/grens.js`; twee sloten, de strengste wint, en `geen-grens` is een
andere stand dan `ruim`).

**`GIFT.md` is het besluit vóór de doneerknop** -- die knop bestaat met opzet
niet (`kern/rtfos/donateur.js`: geen doneerknop en geen incasso, geld aannemen
loopt via RTG Pay en de bank). Lees hem vóór je iets bouwt waarmee de stichting
geld aanneemt. De verantwoording ERNA is af en streng: het donateursportaal op
een eigen code, een giftbewijs dat weigert waar het geen gift is (sponsoring,
tegenprestatie, goederen), en een herkomstcontrole die boven de tienduizend euro
het geld stil zet in plaats van te waarschuwen. Wat ontbreekt zijn drie
BESLUITEN, niet drie functies: waar het geld landt (er is geen codenaam of
positie van de RTFoundation om aan te betalen), welke giftvormen opengaan
(eenmalig, geoormerkt, periodiek -- en periodiek heet alleen zo met een
overeenkomst van vijf jaar), en of de stichting zelf een ANBI is. Dat laatste is
gemodelleerd maar niet aangesloten: `kern/foundationregistratie*.js` en
`kern/rtfos/partners.js` leggen ANBI en RSIN vast van PARTNERstichtingen, en de
giftlaag leest die status nul keer -- terwijl er wel een giftbewijs uitgaat. De
vorm die eruit volgt is die van de terugstortstand hieronder: een schakelaar in
de boardroom die zelf de juridische positie IS, standaard dicht, en een route
die dan weigert mét de reden.

**Let op de terugstortstand (24 augustus 2026).** Of leden hun saldo terugkrijgen
is een schakelaar in de boardroom (`/api/office/bank/terugstorting`), en die
schakelaar *ís* de juridische positie — geen twee dingen die toevallig
samenhangen. `WALLET_SALDO` is daarom geen vaste soort maar **afhankelijk**, met
twee uitgeschreven gezichten in `kern/bevoegdheid/lijst.js`:

| Stand | `WALLET_SALDO` | `LID_UITBETALING` | Wat RTG dan is |
|---|---|---|---|
| `gesloten` | besluit, met grond | bestaat niet | beperkt netwerk, geen vergunning |
| `open` (standaard) | rail, e-geldinstelling | rail, sepa | uitgever van elektronisch geld |

Saldo dat tegen de nominale waarde inwisselbaar is voor de houder ís elektronisch
geld; dat valt niet weg te schrijven. Bouw hier dus nooit een pad omheen dat de
belofte aan leden verandert zonder dat de bevoegdheidsvraag meebeweegt — dan is
de knop een manier om om de vergunningplicht heen te komen. Ontbreekt de stand,
dan geldt per vermogen het strengste gezicht, en dat is niet voor allebei
hetzelfde.

**`CONCERN.md` is het diepte-document van de bedrijvenkant** — RTG Concern,
het Company Launch & Workforce OS: van bedrijfsnaam of idee naar een ingericht
concern, en daarna mensen er moeiteloos in laten werken. Lees vóór je aan
bedrijven, vestigingen, rollen of personeel werkt vooral de paragraaf *De
grenzen*: de AI is hier geen juridische autoriteit (elk juridisch gegeven heeft
een bron én een geschiedenis), een werknemer koopt nooit een pas om te mogen
werken, en toegang verlenen gebeurt waar de rol woont — er komt geen derde
rechtenmodel bij. De kern in één zin: **één bedrijf is niet één KvK**, dus
concern, entiteit, registratie, vestiging, merk en operating unit zijn zes
begrippen en geen zes velden.

**`LINK.md` is de adres- en capabilitylaag** — wat een RTG-code is. De contactpin
was een sociale functie; RTG Link is de laag eronder: één menselijk adres (RTG
PIN), waarachter het platform per context tijdelijke, begrensde bevoegdheden
uitgeeft. De kern in één zin: **een code zegt wie of wat, nooit wat er mag** —
dat wordt bij het scannen berekend uit wie er scant, waar hij staat en wat hij
al mocht. Lees vóór je een QR, een scanner of een koppelweg bouwt vooral
paragraaf 3, de grenzen: de intentielijst toont wat DEZE scanner mag vragen en
nooit wat de ander heeft (anders is het menu zelf een profieluitdraai), een scan
bewijst geen mens, een sticker is geen bron van gezag, en alles wat met een oude
foto nog iets in gang kan zetten hoort tijdelijk te zijn. Er komt geen tweede
scanner, geen tweede parser en geen tweede rem naast de huisbrede uit
`server/kern/sociaal/pin-deur.js`.
**`COMMERCIE.md` is de Commercial Core** — het commerciële subsysteem onder de
prijslijst, in `server/kern/commercie/`: catalogus (`../pasladder.js`), pricing
(`../pasprijs.js`), contract, verbruik (`tegoed.js`), vergoedingen, subsidie,
fee, allocatie, btw en claims. Drie prijsmechanismen (free, fixed, contract) en
het onderscheid dat alles bij elkaar houdt: **catalogusprijs ≠ contractprijs ≠
factuurbedrag**. Vijf regels die er hard staan: de partnervergoeding over omzet
is **nul** en dat is geen instelling; een **bodem is geen prijs** en mag nooit op
een factuur belanden; het ledenvoordeel heeft **vier** bedragen met de invariant
`lid + RTG === bruto === zaak`; een **prijswijziging raakt geen lopend contract**;
en er ontstaan **nooit ongemerkt** variabele kosten (AI boven het tegoed vraagt
altijd een keuze vooraf, en automatisch aanvullen vraagt een maandmaximum).
`claims.poort()` is de release-gate: een bewering die zich AFGEDWONGEN noemt
zonder toets, komt er niet door. Lees COMMERCIE.md als je aan de structuur werkt,
PRIJZEN.md als je een bedrag zoekt.

**`PRIJZEN.md` is de commerciële architectuur** — de ladder (gratis, RTG Pass
65, Business Lite 150, Business vanaf 5.000, Lifestyle vanaf 20.000) en de
prijsformule waar alles aan hangt: **prijs = toegang + verbruik +
verantwoordelijkheid**. Lees die vóór je aan een prijs, een bundel of een
factuurregel werkt. De harde regel daar: **een bodem is geen prijs** — een
ondergrens weigert invoer en toont "vanaf", en mag nooit op een factuur belanden
(dat is de € 9.075-fout uit `kern/pasprijs.js`, met een nieuw getal). De ladder
staat op één plek, `kern/pasladder.js`; `test/pasladder.test.js` handhaaft de vier
regels die machinaal te handhaven zijn. Paragraaf 4 is de eerlijke lijst open
gaten — waaronder drie plekken waar de code iets anders doet dan de
partnervoorwaarden beloven.

**`CONTROLPLANE.md` is het Economic Control Plane** — de laag die vóór iedere
economische handeling bepaalt of zij mag, en achteraf kan bewijzen waarom. Lees
die met COMMERCIE.md ernaast: dat beschrijft wat iets kost, dit wie iets mag.
Vier regels dragen het geheel, en alle vier komen ze uit een fout die hier echt
is gemaakt: **geen belofte zonder afdwingbare capability, geen capability zonder
caller, geen bevoegdheid zonder oorsprong, geen economische actie zonder bewijs.**

De drie die je het snelst nodig hebt: een bevoegdheid is **geen ja of nee** maar
vier dimensies (wat, waar, hoeveel, wanneer) en **delegatie kan alleen
versmallen** — structureel, niet als vuistregel. Een besluit kent **acht
uitkomsten** en "nee" is er maar één van; `ONBEKEND` is met opzet géén synoniem
van `WEIGEREN`, want een storing hoort niet te klinken als een overtreding. En
een nieuwe handhavingsregel **loopt eerst mee** zonder te blokkeren: je kunt niet
afdwingen wat nooit in de schaduw heeft gelopen (`schaduw.js`).

`scripts/capabilityroepers.js` is de meting die dit document eerlijk houdt — hij telt
per capability of er ergens een caller is, en hij vond er vijf die er geen
hadden. Draai hem vóór je een capability toevoegt. Paragraaf 6.1 is de eerlijke
lijst van wat er nog openstaat.
**`KANTOORMACHT.md` is de kantoorkant daarvan** — niet wat een LID mag (dat is
CONTROLPLANE.md) maar wat een MEDEWERKER van RTG mag, en tot waar zijn macht
reikt. Lees die vóór je een kantoorscherm, een backofficeroute of een
"adminfunctie" bouwt. De kern is een omkering: het uitgangspunt *bouw geen
almachtige SUPER_ADMIN* is juist en het is een verkeerde tijd — die is er al.
Eén gedeelde `OFFICE_CODE`, één rol `office`, **26 kamers achter één sleutel** en
**548 muterende kantoorroutes** waarvan er 37 een reden vragen, 99 een spoor
nalaten, 10 allebei en **0** een tweede paar ogen kennen (lexicaal gemeten, graad
`vermoed`). De eerste functie van de laag is dus niet macht toevoegen maar
bestaande macht uit elkaar halen. **Bijna elk onderdeel bestaat al en hangt
alleen niet aan de kantoordeur**: `commercie/voornemen.js` ÍS het execution plan
(vijf harde regels, waaronder dat een goedgekeurd plan niet meer kan veranderen
en dat een nee geen ja wordt door het nog eens te vragen), `commercie/rechten.js`
ÍS de machtskaart (nominaal náást effectief, en met opzet uitsluitend lezend),
`kern/envelop.js` draagt met `correlatie` en `oorzaak` de causale auditketen, en
`command/simulatie.js` heet letterlijk de digitale tweeling. Vier dingen die de
uitwerking corrigeren en die je nergens anders moet herhalen: **de
afdwingladder gaat andersom** (`ENFORCE_EXECUTE` vóór `ENFORCE_READ` — lezen
raakt élk scherm voor de kleinste risicoreductie, en de gevaarlijkste lezing is
al door `kluispoort.js` afgedwongen); **de 26 kamers zijn werkkamers en geen
machtsdomeinen** — 18 zijn bruikbaar, `kantine` en zeven productkamers (atelier,
studio, hardware, architect, reisbureau, regering, opvang) niet, en van de vier
kamers die het model nodig heeft bestaat alleen RISICO nergens: VEILIGHEID,
OPERATIES en BESTUUR zijn bestaande macht zónder kamerdeur; **canary op een
percentage is bij drie medewerkers niet streng maar zinloos** (de verdeling is
deterministisch op de persoon, dus kantoorbeleid rolt per KAMER uit); en **een
Critic op dezelfde invoer als de Planner is een stempel** — de tegenspraak ziet
het plan en het beleid, nooit de redenering erachter. Wat werkelijk vanaf nul
begint zijn drie dingen: er is **geen enkele risicomodule**, er is **geen
historische toestand** van entiteiten (tijdreizen botst bovendien met de eigen
bewaartermijnen), en er is **geen gegevensklasse per VELD** — zonder die derde
wordt het samengestelde klantbeeld een met de hand onderhouden lijst blokken die
binnen een jaar uit de code loopt. De AI is blok 9 en niet uit voorzichtigheid
maar uit rekenkunde: `kern/stuur/beleid.js` kent 0 `/api/office`-paden en
`VERTROUWEN.json` staat op 0 bewezen, dus de bewijspoort waar dat idee op leunt
houdt vandaag niets tegen; 9a (alleen lezen) kan wel vooruit, want `tonen` is de
laagste gezagstrede. Twee grenzen die niet mogen sneuvelen: **een score op een
mens draagt altijd zijn opbouw** en wordt nooit een sorteersleutel — niet op
klanten en niet op medewerkers — en **een versmalling die het gevraagde vermogen
verbergt is een gebrek en geen veiligheid**, dus dekking gaat vóór compactheid,
precies zoals bij `npm run resolverbereik`.
**`MUTATIECONTRACT.md` is de laag ernaast** — niet wie iets mag (dat is
CONTROLPLANE.md) maar wat een TWEEDE aanroep doet, en hoe hard dit huis dat weet.
Lees die vóór je een schrijfroute toevoegt of aan idempotentie werkt. De kern in
één zin: **100% geclassificeerd, 100% meetbaar waar technisch zinvol, 0%
schijnzekerheid — niet 100% idempotent.** Een route die met opzet een tweede
handeling uitvoert is KLAAR zodra dat vaststaat en bewezen is; wie dat omdraait,
verbouwt de architectuur om een percentage. Vijf assen met elk precies één huis
(semantiek → `kern/mutatie.js`, duplicaatgedrag → `lib/idemsleutels.js`, bewijs →
`IDEMPROEF.json`, en toegang + stand → `kern/mutatiecontract/klassen.js`), zes standen
waarvan er maar één naar nul moet (`LEGACY_PENDING_CLASSIFICATION`), en zes
toegangsklassen zodat "geen rol" ophoudt een restpost te zijn. Drie dingen die
niet mogen sneuvelen: **een stand wordt nooit afgeleid uit bewijs** (het bewijs
draagt een voorstel, een mens draagt het besluit), elke stand die toestemming
geeft om níéts te doen eist een meting én een reden, en een herhaling die wordt
GEWEIGERD is een toestandscontrole en geen idempotentie. `MUTATIEINVENTARIS.json`
legt eerst de vijf inventarissen naast elkaar — er liepen vier getallen rond die
alle vier "het aantal routes" heetten — want een percentage tussen twee
verschillende noemers is fictie.
**`TENANT.md` is de buitenkant van de bedrijvenkant** — hoe een partner het
Werk OS onder zijn eigen naam gebruikt zonder dat er een tweede platform
ontstaat. Lees die vóór je aan white-label, SSO-inrichting of "enterprise"
werkt. De kern in vier regels: **`org` IS de klant** (de juridische,
beveiligings- en contractgrens), een werkruimtecode is een productinstantie
daarbinnen, een leverancierscode is een relatie en nooit een identiteit, en er
komt geen vijfde begrip bij. Drie grenzen die niet mogen sneuvelen: het merk
van een klant geldt binnen zijn eigen blok (de RTG-schil verft niet mee), de
herkomstregel is in geen enkele modus uit te zetten (wiens software je
personeelsdossier bewaart is een AVG-vraag, geen merkvraag), en een
enterprisebewering op een scherm heeft een bron — daarom weigert de modus
`sovereign` mét de reden in plaats van te bestaan als knop. Levenscyclus,
uitgang, contract, quota, bewijspoort, de commandobalk met een actiebon, de
gevolgsimulatie en SAML staan er inmiddels; wat er nog steeds níét is, staat in
het antwoord van de server als `nietGebouwd` mét de reden en niet als lege
waarde. Dezelfde regel geldt in het klein overal in deze laag: `nietAfgedwongen`
in het contract, `nietGerekend` in een gevolgsimulatie, en een geweigerde modus
die zegt waarom.

**`HORECA.md` is het diepte-document van de horecakant** — RTG Service
Choreography OS. In één zin: **een kassa registreert wat besteld is; RTG
regisseert wat er nú moet gebeuren om de hele tafel op het juiste moment een
goede ervaring te geven.** Eén servicestroom met zes werkstanden (TAFEL, PDA
SERVICE, VLOER, VUUR, BAR, REGIE) op één gedeelde werkelijkheid — en de PDA is
daarvan de belangrijkste, niet de kleinste. Lees vóór je aan een horecascherm of
de keukenlaag werkt vooral de paragraaf *De grenzen*: generatieve AI bepaalt
nooit of iets veilig is om te eten, een gast is een codenaam (geen labels als
"grote spender"), er komt geen ranglijst op medewerkers, het systeem vinkt niets
zelf af, en wat niet gemeten is wordt niet als getal getoond. Daar staat ook wat
er al staat en dus NIET opnieuw gebouwd moet worden — de rekening is al één
waarheid over alle kanalen, en het ontbrekende scharnier is de **stoel**.

**`BESTUUR.md` is het besturingsvlak** — de achterkant van RTG niet als
backoffice maar als één laag waarin een mens ziet wat er draait, of het gezond
is, en **hoe hard dat bewijs is**. Lees die vóór je aan een bestuursscherm, een
meter of een herstelknop werkt. De kern in één zin: *een cockpit die niet kan
zakken, is een dashboard.* Daaruit volgt de huisregel die overal geldt waar dit
huis iets beweert: elke bewering draagt een **bewijsgraad** (onbekend, vermoed,
gemeten, bewezen) met een datum, `niet vast te stellen` is een eersteklas uitslag
naast in orde en storing, en **vervallen bewijs is geen bewijs**. Twee grenzen
die niet mogen sneuvelen: de laag die iets toont, meet het niet (anders zeggen
twee schermen op een dag iets anders over hetzelfde), en toegang van RTG tot de
omgeving van een klant is een **uitnodiging en geen recht** — geen permanent
`admin = true`, ook niet voor ons eigen kantoor. Wat er wel en niet staat, staat
er gemeten bij; wat er nog niet is, staat er mét de grens waarbinnen het gebouwd
moet worden.

**`APPSTORE.md` is het derdenkanaal** — hoe een app van BUITEN dit huis
binnenkomt. Lees die vóór je aan de App Store, aan een uitgever of aan de cel
werkt. De kern in één zin: **een App Store is geen etalage maar een poort met een
cel erachter.** Zes begrippen (uitgever, app, versie, manifest, keuring,
machtiging) en zes grenzen, waarvan er drie niet mogen sneuvelen: derdencode
draait nooit op de RTG-herkomst (een naamloze cel zonder netwerk, en geen vlag
die dat uitzet), de machinepoort keurt nooit goed (hij laat alleen door naar een
mens van RTG, en nooit naar de uitgever zelf), en een machtiging die een lid niet
heeft VERLEEND bestaat niet — het manifest vraagt, het lid geeft. Er zijn er drie,
en alle drie worden ze uitgevoerd; wat er niet is, staat er met de reden. **Een
app mag geld kosten** (besluit van de eigenaar): de prijs staat in het manifest
en gaat dus door dezelfde keuring, kopen gebeurt in de WINKEL en nooit in de app
(GELD.md par. 3: alles wat een derde raakt is maximaal klaarzetten), de btw hoort
in het land van het LID en wordt nooit geraden, de afdracht van RTG staat op 0%
tot de eigenaar hem zet en werkt alleen vooruit, en een ingetrokken gekochte app
laat een teruggaveRECHT achter dat een mens afhandelt — grens 5 blijft absoluut.
Er komt geen tweede geldstroom: alles loopt over RTG Pay. **De
verantwoordingskant staat er ook**: het inkoopdossier (wie is de leverancier, wat
draait er, wat krijgt de app nooit, waar blijven de gegevens, wat vond de poort,
hoe werkt de uitgang) met per bewering een bron in de code, de tijdlijn van het
lid (wat gaf ik, wanneer nam ik het terug — groeit aan, wordt nooit herschreven,
en de sleutel komt uit de sessie), en de controleronde die eruit haalt wat niet
meer byte voor byte klopt met wat een mens aftekende. Twee dingen daar niet
wegpoetsen: het dossier staat bij het LID en niet achter een kantoorpoort, en het
blok "wat dit dossier NIET zegt" staat er even groot bij — een leverancierspak
dat overal ja zegt is niets waard. Het dossier heeft drie lezers en dus drie
ingangen (kaart in de Mall, `/apps/appstore-dossier.html` als adres dat je
doorstuurt, en "wat de klant leest" op het uitgeversbureau) maar blijft één
bron. Diezelfde pagina zonder app is het **kanaaldossier**: wat voor élke app
hier geldt, met de zes machtigingen die met opzet niet bestaan — die vraag stelt
een inkoper maar één keer, en dat kan alleen omdat elke app op dezelfde cel
draait.

**`COMMERCE.md` is de verkooplaag boven de domeinen** — hoe er één commerce-laag
op de bestaande fiscale, waarde-, voorraad- en fulfilmentinfrastructuur komt te
staan zonder dat er een tweede orderwaarheid ontstaat. Lees die vóór je aan een
winkel, een mand, een afrekening of een retour werkt. De dragende bewering van het
voorstel — één `Koopbaar`-protocol met acht werkwoorden over dertien soorten
verkoopbare dingen — is er eerst **gemeten** (`scripts/commerce.js`,
`COMMERCE.json`) in plaats van aangenomen, want dat is exact de vorm waarin `Asset`
al een keer sneuvelde. De uitslag is streng: 437 koopbare vormen in 100 domeinen,
**0 domeinen die alle acht werkwoorden uitvoeren**, **0 werkwoorden die in álle
koopbare domeinen staan**, en 43 verschillende combinaties. Eén protocol met 42
invullingen is geen protocol; `Koopbaar` wordt daarom een **verklaring van
werkwoorden** en geen interface van verplichte methodes — het model daarvoor is
`kern/appstore/machtigingen.js`, het enige bestand met een doel én een grens. Wat
er wél gevonden is zijn twee echte gedeelde vormen, allebei tussen precies twee
domeinen: het artikel met varianten (mall ↔ retail) en de bestelregel (gast ↔
horeca). Drie dingen om niet te laten sneuvelen: **één mand is niet één
bevestiging** (`kern/mall/bestellingen.js` weigert "betaal alles" met reden, en
dat is een grens en geen gat), er komt geen tweede betaalweg langs
`kern/pay/poort.js`, en Webmaker krijgt géén commerce-logica. En let op par. 3
vóór je begint: het woord **`Kanaal` is al bezet** — `SEMANTIEK.json` heeft
`KANALEN` in de top als botsing (4 domeinen, 4 betekenissen, overlap 0,10), dus
het nieuwe kernbegrip hernoemt eerst of wijkt uit. Het duurste gat wàs `retour`: 6 van de 100
domeinen kenden iets dat erop lijkt en geen ervan was een goederenretour. Dat gat
is gevuld -- `kern/commerce/retour*.js` plus `routes/supplier/retour.js`: zes
gronden, vijf standen die elk zeggen wélke partij ze zet, een bevroren bedrag en
btw-tarief, en een geldbesluit dat wordt KLAARGEZET en nooit uitgevoerd.
**De laag staat inmiddels** (`server/kern/commerce/`, acht bestanden, gemonteerd in
`opzet/kernlaag2b.js`, scherm `/apps/commerce.html`): werkwoorden, koopbaar, graaf,
mand en een afrekening per verkoper, draaiend op 100 koopbaren uit de seed. Twee
dingen die echte data blootlegde en die je nergens anders moet herhalen: `bedrag`
in `kern/mall/aanbod.js` staat in EURO'S en niet in centen, en `vanaf` is een VLAG
en geen bedrag -- op een vanaf-prijs wordt niet afgerekend.

**`DEVELOPERCLOUD.md` is de richting boven de App Store** — RTG Developer Cloud:
een ontwikkelaar bouwt hier in dagen wat elders maanden kost, omdat hij auth,
billing, compliance, hosting, permissies, observability en enterprise-controls
niet zelf hoeft te bouwen. Lees die vóór je aan een SDK, een objectmodel of een
ontwikkelaarsvoorziening begint. Het is een richtingsdocument zoals PLATFORM.md:
per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar aanziet. De
belangrijkste zin staat in paragraaf 2: **een universeel objectmodel moet worden
GEVONDEN in de domeinen, niet eroverheen verklaard** — dat is precies de fout die
de oude super-app-regel al een keer heeft voorkomen. **Die meting is gedaan**
(`scripts/objectmodel.js`, `OBJECTMODEL.json`) en de uitkomst is streng: 71% van
de velden hoort bij precies één domein, en **`Asset` bestaat niet** — tafel,
kamer, podium en leaseauto delen niets buiten hun verpakking. Wat er wél uitkwam
zijn vier kandidaten, waarvan er één de drempel haalt: een **ontwerpopdracht**,
gedeeld door architect, atelier, hardwarelab en studio. Voeg geen type toe dat
niet uit die meting komt.

**`CREATE.md` is de laag bóven de Developer Cloud** — RTG Create: niet één soort
ontwikkelaar maar de hele ladder van amateur tot enterprise, over de vier
makersroutes die dit huis al heeft (Website-maker, Website Platform, App Store,
tenant). Lees die vóór je iets aan een maker, een projectbegrip of een
publicatiestroom verandert. Alles hangt aan één zin: **Create verenigt
vindbaarheid, identiteit, publiceren, bewijs en de makerservaring — nooit
domeinbetekenis zonder gemeten overlap.** Create maakt de ervaring uniform, niet
de implementatie; de formule is *gedeelde ingang, zelfstandig domein*. Daaruit
volgt de grondwet CREATE-01 t/m 07 in par. 1, met bij elke regel wie hem
handhaaft en waar dat nog niemand is. De toetsvraag van PLATFORM.md par. 0b
beslist per maker of samenvoegen mag, en waar het antwoord niet vaststaat wordt
het **gemeten** zoals `scripts/objectmodel.js` dat deed — niet aangenomen.
Website-maker en Website-studio delen aantoonbaar een kern; Lesmaker en
Clips-studio delen alleen een woord. Let in par. 3 op de bloktaal: de naad loopt
niet tussen consument en zakelijk maar tussen **inhoud (12), view (`zaakdata`) en
handeling (`formulier`)** — een blok dat iets DOET is precies waar machtigingen
aan hangen, en een indeling in consument/zakelijk had die vraag nooit gesteld.
Par. 9 staat er even groot bij: drie dingen die makkelijk voor bestaand worden
aangezien en het niet zijn — **Magnaat is een leerspel voor mensen en hoort niet
in de ontwikkelaarsroute** (de beproevingsomgeving voor software is een eigen
ding, met `scripts/aanval.js` en `scripts/chaos.js` als eerste bouwstenen), de
App Store-keuring keek niet naar toegankelijkheid (inmiddels wél, en als POORT:
zie par. 9.2), en er is geen kostenvlak. En
par. 10 draait één aanname om die vaak fout gaat: van <!--getal:idem.routesMetRol-->3803<!--/getal--> routes met een rol
zijn er <!--getal:idem.beoordeeld-->1564<!--/getal--> beproefd op herhaalbaarheid en <!--getal:idem.ongemeten-->3079<!--/getal--> ongemeten (`IDEMPROEF.json`,
levend getal — `npm run getallen` houdt het bij),
maar het doel is **niet alles idempotent — het is alles geclassificeerd**, met
`UNKNOWN` verboden voor nieuwe publiek aanroepbare ontwikkelaarsopdrachten.

**`OS.md` is de laag ónder de Developer Cloud** — RTG Universal OS: niet "RTG
heeft veel operating layers" maar "RTG is één besturingssysteem van
gestandaardiseerde capabilities". Lees die vóór je een capability, een woordenlijst
met rechten of een nieuwe laag toevoegt. De eerste wet van de opzet — *Everything
is a Capability* — is er eerst **gemeten** in plaats van aangenomen
(`scripts/capabilityroepers.js`, `CAPABILITEIT.json`), en de uitkomst is streng: er is
geen capabilitylaag in deze code, er zijn er **<!--getal:capabiliteit.lijsten-->21<!--/getal-->** met <!--getal:capabiliteit.leden-->250<!--/getal--> leden,
91% van de leden woont in precies één lijst en geen twee lijsten lijken op elkaar. Twee bestanden dragen
allebei een `VERMOGENS` met nul gedeelde leden — de les van het gedeelde
routevoorvoegsel, nu op een woord. Daaruit volgt de grens die het document
toevoegt aan de opzet: één grammatica mag over het **platformvermogen**
(`betalen`, `binnenkomen`, `SEPA_UIT` — allemaal "mag deze aanroep, en doet hij
het?"), en nooit over het **domeinvermogen** (`bookings`, `rides`, `menu` — wat voor
zaak is dit), want dat is dezelfde fout als `Asset`. Het contract van punt 7 bestaat al en staat in het kleinste hoekje van
het huis: `kern/appstore/machtigingen.js` draagt als enige een doel én een grens.
**De eventenvelop staat** (27 augustus 2026): `kern/envelop.js` geeft elk bericht
op de bus acht velden — id, tijd, versie, kanaal, actor, correlatie, oorzaak,
classificatie — en de keten loopt vanzelf door, zodat een gevolg-gebeurtenis weet
waardoor zij ontstond. Drie grenzen daar: **de actor is een codenaam** (de envelop
weigert wat op een contactgegeven lijkt, want met `REDIS_URL` gaat hij over een
netwerk), **`onbekend` is geen `openbaar`** (en een gevolg erft de classificatie
niet — dat zou raden zijn), en **de levering gaat voor** (een geweigerde actor
houdt een melding nooit tegen, maar verdwijnt ook nooit stil). Wat er nog niet is,
staat er met de meting erbij: van de <!--getal:idem.beoordeeld-->1564<!--/getal--> beproefde muterende routes zijn er
<!--getal:idem.beschermd-->1562<!--/getal--> retry-veilig, en een schemaregister (`payment.authorized.v1` met een vorm
erachter) bestaat niet — de envelop zegt met opzet nooit WAT. Zeven punten die een besluit van de eigenaar vragen staan in par. 4.
**Het goedkoopste daarvan is genomen (27 augustus 2026):** het woord dat in twee
lagenmodellen niet hetzelfde betekende, is hernoemd — laag 4 van `PLATFORM.md`
par. 2 heet nu **genre-cap** (domeinvermogen), en *capability* blijft over voor de
herbruikbare bedrijfsfunctie (platformvermogen). `scripts/lagen.js` leidt de
lagenmodellen af uit de documenten zelf en `test/genrecap.test.js` zakt zodra twee
modellen weer een naam delen of een citatie achterloopt op zijn bron. Wat níét
opgelost is: er liggen nog steeds twee lagenmodellen en de opzet stelt een derde
voor. Die keuze staat nog open; alleen de naambotsing is weg.

Die hernoeming legde meteen bloot waarom hij nodig was: `PLATFORM.md` noemde
`rooms` als voorbeeld-cap, en **die cap bestaat niet** — geen van de 73 genres
draagt hem en `kern/werkvormen.js` maakt hem nergens aan. `kern/fiscaal/tarief.js`
besliste er wel op of een verkoop 'logies' is, dus die tak was dood en een
verblijfszaak rekende te veel btw (appartement NL 21% in plaats van 9%, hotel DE
19% in plaats van 7%). De tak keek de hele tijd groen omdat een toets hem met
verzonnen invoer voedde. Een cap die een document noemt, wordt sindsdien tegen de
code gehouden.

**`MAGNAATLAB.md` is Magnaat als testhal** — de rol bovenop het spel dat
`GAMEHALL.md` beschrijft: de simulatieomgeving waarin een capability bewijst dat
hij werkt vóór productie. Lees die vóór je Magnaat aan RTG koppelt of een
simulatiewereld toevoegt. Ook hier is de dragende bewering eerst **gemeten**
(`scripts/magnaatlab.js`, `MAGNAATLAB.json`): de simulatielaag telt 66 modules en
116 requires, en raakt daarmee **2 van 415 kerndomeinen** aan — 0%. Als testhal
bewijst Magnaat vandaag niets over RTG, en niet omdat hij RTG heeft nagebouwd:
van de 34 paren met hetzelfde onderwerp deelt er **geen enkele** een vorm. Het
probleem is afwezigheid, niet dubbeling — er hoeft dus niets te worden
afgebroken. Veertien van de vijftig punten staan al (chaos, aanvalsbatterij,
tenant-isolatie, doelschending, canary met automatische terugrol, shadow
execution op echt verkeer, de bewijsmatrix), maar ze draaien allemaal tegen de
echte server met testdata en geen van hen in een wereld. De pijp tussen spel en
platform bestaat trouwens wel en loopt de verkeerde kant op: `magnaat-capabilities.js`
leest RTG's echte routes en maakt er gameplay van, mét risicoclassificatie — wat
ontbreekt is de retourrichting. **De scherpste bevinding
staat in par. 3:** `kern/pay/poort.js` kent geen enkele demo-, test- of spelstand,
en dat is precies waarom Magnaat er niet bij kan — een spelbank moet geld uit
niets maken. De uitweg is dus géén vlag in de poort maar een vierde provider naast
de bestaande demo-provider in `server/betaal.js`; de regel die daaruit volgt is
**een simulatie-adapter vervangt de rail, nooit de poort**. **Die rail staat**
(27 augustus 2026): `server/betaal/synthetisch.js`, en de poort is er geen letter
voor veranderd. Wat hij toevoegt boven de demo is dat hij **stuk kan** — vier
afloopen (`betaald`, `geweigerd`, `traag`, `terugboeking`), reproduceerbaar
gekozen uit de idempotentiesleutel. Drie grendels, alle drie fail-closed en elk
met de reden erbij: alleen met `RTG_SIMULATIEBANK=1`, nooit naast een échte
provider, nooit in productie. En geen knop in de productieweg: geen enkele
HTTP-route geeft een scenario door, want dan kan iemand een betaling laten slagen
die niet geslaagd is. **En Magnaat rijdt er inmiddels op**:
`kern/spellen/magnaat/rtg-keten.js` stelt de geldpompvraag aan RTG Pay
(`npm run magnaat:pomp:rtg`) — vijf perverse volgordes, exact nul verschil, en de
idempotentie gemeten (twintig aangeboden tikken, veertig grootboekregels). Het
bereik van de simulatielaag ging daarmee van 1 naar 2 kernmodules; het
percentage bleef 0% en dat is geen tegenvaller maar te grof gemeten — één
capability is geen percentage. Het is een **proefstuk en geen koppeling**: geen
speelbeurt komt langs RTG Pay, en `test/magnaat-rtgketen.test.js` zakt zodra een
spelmodule `kern/pay` laadt. Twee dingen om niet
te laten sneuvelen: een Magnaat-PASS is bewijs en geen vergunning (wat het huis
buiten Magnaat niet toestaat, staat een groene simulatie niet toe), en scores
mogen op apps en capabilities maar niet op mensen. En er staan al **twee**
synthetische werelden (Magnaat en `kern/hospitality-universe/`) die elkaar
aanroepen — die vraag hoort beantwoord vóór er een derde bij komt.

**Punt 22 is ook gemeten** (par. 4.6): kunnen twee plekken die elk niets fout doen
samen een codenaam terugvoeren naar een mens? `scripts/afleidbaar.js` leest elk
objectliteraal in `server/` als een stel velden dat samen reist, en maakt daar een
graaf van; de afstand van `codenaam` naar een harde identificator ís de bevinding.
Zes staan er **rechtstreeks** naast een codenaam, twee op twee stappen, en het
**bsn nergens**. Het handwerk erna verwierp de helft — twee treffers zijn de
identiteitskluis zelf (waar de koppeling hóórt, met een auditregel), twee zijn
verklaarbare valse treffers, één zit achter een vlag, en één verdient een besluit:
codenaam plus bezorgadres blijft staan in de operationele data zonder
bewaartermijn. De meter meet **structuur en geen bevoegdheid** — een lid dat naar
zijn eigen gegevens kijkt ziet er hetzelfde uit, en een pad door een knooppunt als
`code` is vrijwel zeker geen koppeling. Zulke paden worden apart gemeld en niet
weggelaten.

**`BEWIJSMACHINE.md` is de lat boven de testhal** — niet of Magnaat kan bewijzen
dat RTG vandaag klopt (`MAGNAATLAB.md`) maar of hij kan voorspellen dat RTG
mórgen nog klopt. Lees die vóór je een begrip introduceert, een register aanlegt
of een scorecard bouwt. De opzet vraagt een semantisch register naar aanleiding
van de twee `VERMOGENS`; de vraag ervóór is gemeten (`scripts/semantiek.js`,
`SEMANTIEK.json`) en het was **geen incident**: van de <!--getal:semantiek.namen-->117<!--/getal--> namen die in meer dan
één domein staan, dragen er **<!--getal:semantiek.betekenissen-->100<!--/getal--> meer dan één betekenis** — samen 284
betekenissen, met `SOORTEN` op **39**. Daarnaast **29** betekenissen die op meer
dan één plek wonen én **106** paren die dezelfde waarheid onder een ándere naam
dragen — die tweede ronde bestaat omdat de eerste ze miste, en de duurste
dubbeling draagt per definitie twee namen. Botsing en dubbeling vragen het
tegenovergestelde: hernoemen tegenover samenvoegen. **Twee onafhankelijke
metingen wijzen naar dezelfde vier domeinen** (`architect`, `atelier`,
`hardwarelab`, `studio`): `OBJECTMODEL.json` via gedeelde vormen, `SEMANTIEK.json`
via `PALET` en `STATUS` op vier plekken. Dat is het sterkste bewijs voor een
gedeeld type dat hier te krijgen is. **De eerste reparatie is gedaan:** de vraag
"welke passen bestaan er" stond op vier plekken (twee met een identieke `pasVan`)
en woont nu in `server/kern/passen.js`, met `BETALEND` afgeleid in plaats van
overgetypt — zelfde patroon als `kern/pasprijs.js`. Drie mutaties raak, en de
meter bewoog mee: 111 → 101 (en staat nu op 106: deze tak zette er zelf
code bij, en de meter telt de hele boom). De 78 zijn geen foutenlijst
maar een prijskaart: ze zeggen wat één capability-grammatica (`OS.md`) gaat
kosten en waar hij het eerst schuurt. **Drie dingen die dit huis al heeft besloten
en die de opzet raakt:** een enkel `READY` boven een bewijs-scorecard is precies
wat LAT-regel 11 en `check.js` regel 48 verbieden (bewijsgroen is geen
go-live-groen, en `scripts/zekerheid.js` bestaat juist omdat losse eerlijke
getallen samen een gevaarlijk gevoel geven); één samengesteld entropiecijfer
verbergt welke van de 31 geratelde meters bewoog; en een register dat naast de
code leeft, wordt binnen een jaar zelf de 78ste botsing — het hoort te worden
afgeleid, met bron én handhaver zoals `WETTEN.json`. Wat er nagemeten **niet** is:
release-provenance (geen SLSA, geen SBOM, geen build-attestatie) en een zoeker
die zelf tegenvoorbeelden genereert — `scripts/sabotage.js` overtreedt elke wet
één keer met opzet, en dat is iets anders dan zoeken.

**`SERVICE.md` is de laag die de hulplijnen orkestreert** -- RTG Service: niet
een vijfde klantenservice naast de vier die er al waren (de AI van de RTG Pass,
de menselijke concierge, de ledenbalie en RTG Bijstand), maar de
GEMEENSCHAPPELIJKE ENVELOP eromheen. Lees die voor je iets bouwt waarmee een
gebruiker om hulp vraagt of waarmee een medewerker in het dossier van iemand
anders kijkt. Die vier blijven bepalen wat iets BETEKENT -- een klacht blijft van
`kern/ledenbalie-zaken.js` -- en Service bepaalt wie eraan werkt, sinds wanneer,
met welke bevoegdheid en wat de melder ziet. Het fundamentele object is daarom
een **Zaak met een tijdlijn** en geen ticket met een status: stand, eigenaar,
prioriteit en de vier klokken zijn er allemaal uit AF TE LEIDEN, en
`kern/service/loop.js` is de enige module die die tijdlijn schrijft. Drie dingen
die niet mogen sneuvelen: **een zaak weet waarover het gaat en opent niets** (het
veld `betrokken` is een soort plus een code, en `verwijzing()` gooit al het
andere weg -- gegevens vragen een machtiging, en die vraagt een bevestiging van
het lid), **een machtiging kan alleen versmallen** (de doorsnede met wat het team
nodig heeft, met verval als BEREKENDE toestand en een tweede handtekening onder
zwaar werk -- de vorm van `kern/command/bijstand.js`, met de zaak als bereik), en
**"ik wil een mens" is een contract en geen beleefdheid**. Dat laatste herstelt
een echt gebrek: `kern/ai.js` zette voor de RTG Pass hard `needsConcierge = false`,
en dat klopte als merkregel (de RTG Pass krijgt De Rechterhand niet) maar liet
een lid nergens bij een MENS uitkomen terwijl de ledenbalie hem gewoon helpt.
`kern/service/mens.js` haalt die twee uit elkaar -- De Rechterhand is
UITVOERING en blijft gekocht, een mens bij een probleem is een ONDERGRENS voor
elk lid met een account -- en `test/servicemens.test.js` houdt per pas vast dat
hij die zelf kan aanvragen. De vaste steuncode van de balie is vervangen door een
**bevestiging** (het lid ziet wie, waarvoor en wat er opengaat, en drukt zelf),
met de code als terugval: zes cijfers, vijf minuten, een keer, aan die ene zaak
gebonden. Par. 5 heeft vier klokken waarvan de vierde -- wacht op de melder --
van de andere drie wordt AFGETROKKEN, want zonder hem meet je de melder. Par. 7
is de schaalwinst: twintig meldingen die hetzelfde zeggen worden een VERMOEDEN
(geen tweede incident -- dat blijft van `kern/command/incident.js`, en het
nummer komt daarvandaan), een mens bevestigt, en daarna is het EEN oplossing en
twintig melders die vanzelf worden bijgewerkt -- maar **een hersteld incident
sluit geen zaken**, want dat de storing weg is bewijst niet dat het probleem van
dit lid weg is. Par. 8: de persoonlijke stand zegt NOOIT "alles werkt"
(beschikbaarheid wordt niet per lid gemeten) en houdt uit elkaar wat een storing
IS en wat Service erover heeft GEMELD. Par. 9: foutsignalen op vingerafdruk,
waarbij `gebruikers` op `null` staat MET de reden -- de foutingang is zonder
inlog en kent geen mensen om te tellen. Par. 13c is RTMail als INGANG: post aan `hulp@` wordt een zaak, met de melder
uit de identiteitskluis -- een besluit van de eigenaar met een prijs die
uitgeschreven staat, want de mailingang wordt daarmee een LEESWEG NAAR DE KLUIS
en draagt dus reden en journaalregel. De scherpste vraag daar is niet de kluis
maar de AFZENDER: `From:` is door iedereen te typen, dus de kluis wordt pas
bevraagd als DKIM of DMARC hem bevestigt (SPF alleen niet -- die spreekt over de
envelop en niet over de From die wij opzoeken). Zonder stempel geen zaak, mét de
reden en nooit stil. Par. 13 is bellen naar RTG BINNEN de app (geen
provider, geen nummer, en de zaak ligt ernaast open): een dienst van Lifestyle en
Business, terwijl EEN MENS dat nadrukkelijk niet is -- die ondergrens uit par. 3
blijft voor elk account gelden, en de weigering om te bellen zegt er de weg naar
een mens bij. Beide kanten dragen een MEELEESBAAN (`shared/meelezen.js`), want een
live gesprek zonder weg naar tekst sluit een dove deelnemer uit -- en dat gesprek
heeft de ratel `OPEN_MAX` in `scripts/check.js` van 8 naar 10 gezet. Die mag
volgens zijn eigen regel alleen omlaag; de verhoging staat daar dus
UITGESCHREVEN, met de reden en met het adres van wat hem weer omlaag brengt (een
lokaal spraakmodel via LOCAL_AI_URL). Wie een ratel omzeilt zonder het te zeggen,
sloopt de ratel zelf.
Par. 13d is het ondertitelen: `kern/spraaktekst.js` zet spraak om met een LOKAAL
model en wijkt NOOIT uit naar buiten -- een tekstantwoord bij de derde aanbieder
is net zo goed, de stem van een lid niet. Iedereen ondertitelt ZICHZELF (de
spreker beslist over zijn eigen stem, en niemand ondertitelt een ander achter zijn
rug), de knop hangt in de meeleesbaan zelf zodat alle acht gesprekken hem tegelijk
kregen, en de ratel van keuringsregel 49 ging daarmee van 10 naar 2. Die twee zijn
UITZENDINGEN: eenrichting, dus zichzelf ondertitelen helpt de kijker niets. Par.
13e is de capability-telling (`scripts/servicecaps.js`), en die vond eerst geen
ontbrekende poort maar een bevoegdheid die er niet in hoorde: **`zaak.lezen` hangt
aan de ZETEL en niet aan een bevestiging** -- het lid las bij elk verzoek "opent:
zaak.lezen" en gaf dus toestemming voor iets dat de medewerker al mocht. Elke
bevoegdheid draagt nu een GROND, en 8 van de 9 die het lid bevestigt hebben nog
geen lezer: ratel 65, mag alleen omlaag.
Par. 12 is de kwaliteitsmaat, en die is met opzet geen
afhandeltijd: gemeten wordt hoeveel problemen zijn opgelost ZONDER dat de melder
zijn verhaal opnieuw hoefde te doen -- en wat er NIET gemeten wordt (tevredenheid,
afhandeltijd per medewerker, een samengesteld rapportcijfer) staat mét de reden
in het antwoord zelf, want een leeg vak wordt gevuld met iemands eigen indruk.
Par. 11 is de ingang voor een ZAAK, die er
niet was: een leverancier kon RTG nergens iets melden -- er stond wel een zin over
een vaste contactpersoon, maar geen kanaal. Het systeem vraagt daar niet wie er
meldt (de zaakcode komt uit de sessie), de doelgroep wordt door de ROUTE gezet en
niet uit het lichaam gelezen, en een zaak krijgt een MENS en niet De Rechterhand
-- welke tabel geldt leest `loop.mensVraag()` uit de DOELGROEP van de zaak.
De AI heeft er drie rollen en maar
een ervan kan iets OPENEN: die vraagt langs dezelfde weg als een medewerker
(`kern/service/onderzoeker.js`) en het lid ziet dat er een MACHINE vraagt --
afgeleid uit het voorvoegsel `ai:`, dat niemand zelf kan zetten. Vier grenzen
eromheen: de AI vraagt niet uit zichzelf (het zijn routes van een mens, want een
machine die overal standaard om toegang vraagt maakt van de bevestigingsknop een
reflex), krijgt nooit zwaar werk (dat vraagt een tweede MENS, en die
handtekening kan hij niet zetten), leent nooit een machtiging die op naam van een
mens staat, en opent niets voordat het lid heeft gedrukt. Dat is meteen de eerste
plek waar `magNu()` een AANROEPER heeft -- tot dan legde de machtiging toestemming
vast maar opende zij niets, voor een mens net zo min als voor een AI. Par. 10 is de cockpit
(`/apps/service.html`): zaakgericht en met opzet ZONDER ledenzoeker -- vrije
inzage blijft bij de ledenbalie, met een reden en een journaalregel -- en alles
wat het bord beweert draagt een "waarom?", inclusief wat er NIET is gewogen. Het
bord stelt geen oorzaak vast en zegt dat er ook bij. En par. 13 staat er even
groot bij: de kale meetronde over de zevenentwintig routes vond VIER fouten die
geen enkele toets zag en die er bij het LEZEN alle vier prima uitzagen --
waaronder twee dubbelklikken die twintig melders twee keer hetzelfde stuurden.
Twee vondsten uit de browsertoets horen daar los bij, want ze gelden voor ELK
scherm: een functie `open()` op het hoogste niveau van een klassiek script
overschaduwt `window.open` die de gedeelde schil gebruikt, en die schil laadt met
`defer` en verbouwt de header -- schrijf je als eerste in `#titel`, dan sloopt de
TypeError je hele werkblad voordat het gevuld is, en dat ziet eruit als een
willekeurige flake.

**`ONTWERP.md` is het RTG Design System 2.0** — de vormtaal: merk-elementen
tegenover werk-elementen (Bodoni is ceremonieel en staat op een gesloten lijst
rollen), de drie modi World/Pro/Command, uitzonderingsgestuurd ontwerpen, kleur
als betekenis, en de eigen componenten (Signal Rail, Reference, Action Line,
Context Pane, Command Palette). In één zin: **van veraf classy, van dichtbij
extreem krachtig.** Lees die vóór je aan een scherm begint; `test/ontwerp.test.js`
handhaaft wat machinaal te handhaven is.

**`MATERIAAL.md` is de materialenleer** — een luxemerk denkt niet in kleuren
maar in materialen en licht. Vijf materialen met elk een basis, een glans en een
rand: Pearl (gepolijst keramiek, warm en nooit blauw), Gold (geborsteld
champagnegoud, mat), Onyx (pianolak, nooit egaal), Bordeaux (fluweel, absorbeert
licht) en Royal (satijn, als enige koel). Plus de twee letterrollen. Kies een
materiaal, geen kleur; `test/materiaal.test.js` meet of het er nog een is.

**`WERELD.md` beschrijft het beginscherm** — en de harde regel daar is: er is er
één, en dat is de werktafel van RTG Command. Inloggen, je laatste werkblad
sluiten en op Home drukken komen alle drie op dezelfde lege keuze uit. De klok
was hier ooit de kern, met de werelden als merken op een bezel eromheen; die is
weg (17 augustus 2026), en het springboard eronder is hem gevolgd. Het horloge
staat nu alleen nog op het inlogscherm. De werelden staan bovenaan de bank, hun
onderdelen op hun eigen huis, en de enige lijst werelden blijft `MAPPEN` in
app-main. Rahul woont in de schilbalk zelf: zijn mond staat rechts in de balk
"Kies een wereld", en een tik maakt van diezelfde balk een vraagveld
(`shared/command/praat.js`) — geen paneel dat erover komt. Het bedieningspaneel
(met uitloggen) staat in de voet van die bank. De schil van `apps/app.html`
bestaat nog als **la** voor die panelen, niet als scherm. Lees ook wat er bewust NIET staat (een verzonnen statusstrook, een
voorgekookt werkblad) vóór je er iets bij zet.

**`WERELDEN.md` is de kaart** — vier werelden, een kern eronder, en de pas die er
dwars op staat. **LivingOS** (mijn dagelijks leven), **WorkOS** (mijn werk en
organisaties), **TravelOS** (mijn reizen) en **FoundationOS** (RTFoundation en
haar maatschappelijke werk), met de domeinen een niveau lager. Het document trekt
vier begrippen uit elkaar die steeds door elkaar liepen: **World** (waar ben ik),
**Capability** (wat kan het systeem), **Access** (wat mag ik) en **Pass** (waar
betaal ik voor) — *Core ondersteunt Worlds, Worlds organiseren Experiences,
Access bepaalt wat zichtbaar is, Passes bepalen commerciële rechten.* Bij twijfel
is er één vraag: **in welke context denkt de mens dat hij zich bevindt wanneer hij
dit gebruikt?** Daaruit volgt dat de bouwer van een capability niet bepaalt in
welke wereld hij hoort — RTFoundation mag eigenaar zijn van iets dat in LivingOS
verschijnt. Twee harde regels: **een wereld draagt nooit de naam van een pas, ook
niet de stam ervan** (`LifeOS` sneuvelde daarop tegenover Lifestyle Pass), en
**RTG Core is geen wereld** — 24 functies zitten in élke doelgroep en reizen met
de mens mee. `test/wereldregister.test.js` houdt het register fail-closed en
vergelijkt de kaart met de code, zodat een document dat niet meer klopt de bouw
laat zakken in plaats van stil verkeerd te blijven staan.

**Wat er precies in elke wereld hangt staat in `WERELDLIJST.md`** — 76
onderdelen met hun adres, geschreven uit `MAPPEN` met `npm run wereldlijst` en
bewaakt door regel 50 van `scripts/check.js`. Wat daar bewust NIET in staat is de
laag ertussen: welke onderdelen samen "het huishouden" of "zorg en gezin" heten
staat nergens in de code, en dat is een ontwerpbesluit en geen afleiding.

**De ladder van de drie passen staat daar ook**, en hij is na te rekenen met
`npm run groepen` (dat schrijft `GROEPEN.md` uit de bron): **RTG Pass** is het
hele platform voor één mens (140 functies), **Lifestyle** is hetzelfde platform
maar er doet iemand het vóór je (143, met De Rechterhand, RTG Zakelijk en het
Privékantoor als verschil — je koopt uitvoering, geen functies), en **Business**
krijgt daarbovenop een hele wereld (157, waarvan twaalf van de veertien
exclusieve functies WorkOS zijn). Lifestyle is een strikte deelverzameling van
Business; er is geen enkele functie die alleen Lifestyle heeft, en dat is een
vorm en geen gat. **Waar de prijs aan hangt is wel besloten en staat in
WERELDEN.md:** RTG betaalt voor het platform, Lifestyle voor **uitvoering** (er
doet iemand het vóór je) en Business voor **schaal** (per organisatie, per
vestiging, per medewerker). Niet op functies — drie functies verschil dragen geen
factor driehonderd, en functies weghalen bij RTG Pass botst met "premium, ook aan
de onderkant". Het bedrag zelf staat nergens in de code.

**`ADAPTIEF.md` is de adaptieve interactielaag** — hoe dezelfde capability zich
gedraagt op bureau, tablet, telefoon en stem. In één zin: **bureau toont veel
context tegelijk, telefoon toont één duidelijke taak met zijn handelingen binnen
bereik, en de capability zelf verandert niet — alleen zijn vorm.** Geen mobiele
versie en geen responsive-ronde: een capability declareert per vorm zijn
presentatie (werkbalk, contextmenu, selectiebalk, lade, paneel, taakmodus), en de
harde grens is dat **verbergen niet bestaat** — een handeling die op bureau
bestaat en op telefoon geen vorm heeft, is een gebrek en laat de toets zakken.
De schilbalk onderin is het eerste instrument: zijn middenzone draagt de werelden,
de bladacties of de selectieacties, met links altijd de bank en rechts altijd
Rahul. Lees die vóór je iets mobiel "even responsive" maakt.

**`GRAMMATICA.md` is de RTG Mobile Interaction Grammar** — de vaste manier waarop
álle RTG-software op een telefoon reageert, in zeven zinnen: *ik wil iets doen →
mijn duim vindt het onderaan; ik wil meer → ik trek de interface naar me toe; ik
selecteer iets → RTG begrijpt mijn context; ik wil weten wat er gebeurt → RTG toont
de toestand zonder mij te storen; ik doe iets gevoeligs → RTG vertraagt precies
genoeg; ik maak een fout → ik kan bijna altijd terug; ik wissel van RTG-product →
de bediening voelt bekend.* Vijf gebaren met elk één betekenis (tik doet, lang
drukken legt uit, omhoog trekken geeft meer, selectie verandert de acties, de orb
stelt voor), vijf gewichten van `licht` tot `plechtig`, en drie grenzen die niet
mogen sneuvelen: **ongedaan vóór bevestigen** (twintig "weet u het zeker?"-vragen
leren mensen op ja drukken), **een verhindering draagt altijd een reden** (er komt
geen grijze knop zonder uitleg bij), en **de orb stelt voor maar beslist nooit** —
wat er gebeurt loopt langs capability, verhindering en gewicht, en `plechtig` wordt
door een mens afgemaakt. Lees die vóór je een handeling toevoegt aan een scherm.

**`WERKRUIMTE.md` is het desktopparadigma** — RTG Desktop is not a collection of
pages, it is a movable operational space. Surfaces met een gouden greep rond een
centrale console, en Context Linking dat alleen een verwijzing rondstuurt.

**`ONDERHOUD.md` is de onderhoudslaag** — vier wachters voor de grond die
zonder commit verschuift (runtime, browser, live-site, wet) en de herstellus
die van elk rood licht een fix-issue met diagnose maakt. De twee vaste grenzen
daar: mergen blijft mensenwerk (met als enige, gesloten uitzondering de
Dependabot-klassen in `automerge.yml`), en de wetwacht meldt alleen — het
juridische oordeel blijft bij een mens.

**`TIKKEN.md` zegt hoe diep het huis is** -- hoeveel tikken elke functie van het
beginscherm af ligt, gemeten met `scripts/tikken.js` in een echte browser op
telefoonformaat en niet geschat. De belofte staat er in twee helften, en de
tweede is even hard als de eerste: **elke functie van een lid ligt binnen vijf
tikken, en elk scherm dat er niet ligt draagt een uitgeschreven reden** (ROL,
LANDING of STAND, in `MET_REDEN`). Een belofte "alle schermen" zou het huis
dwingen een meldkamer op het beginscherm van een lid te zetten -- daarom meet de
meter per ROL (lid, zaak, kantoor), elk met een echte sessie, en telt de kortste
weg van de mens die er hoort te komen. Een rol die niet ingelogd kon worden laat
de controle zakken: niet gemeten mag nooit als "in orde" langskomen. Lees die vóór je
een scherm toevoegt of een menu verandert. Twee dingen daar niet wegpoetsen: de
meter telt alleen ECHTE bestemmingen (een knop die zijn adres alleen in
JavaScript kent, bestaat niet voor hem -- daarom is hij niet met een belofte op
te poetsen, en daarom draagt elke rij van de sprong zijn `data-url`), en de korte
weg zelf, `shared/sprong.js`, verzint geen bestemmingen: zijn lijst wordt
AFGELEID uit `MAPPEN` door `scripts/sprongindex.js`. Er komt geen tweede lijst
apps bij en geen tweede spotlight naast die van de leden-app. De sprong toont ook
HANDELINGEN: die van dit scherm komen uit `RTGAppMenu.functies()` (dezelfde lijst
als het app-menu, geen kopie), die van andere apps uit
`shared/handelingindex.json` -- gelezen uit de knoppen van de schermen zelf, en
een tik brengt je ERHEEN zonder iets uit te voeren. Of dat werkt is niet beweerd
maar gemeten: `scripts/vindbaar.js` (`VINDBAAR.json`) vraagt of je een functie
terugvindt met het woord dat erop staat, en die stond op 21% voordat de
handelingen erin zaten.

**`TOEGANKELIJK.md` zegt wat een mens met een handicap hier wel en niet kan** — per soort barrière, met de meting erbij en met de dingen die geen poort ooit ziet. Lees die vóór je iets aan een scherm verandert. De harde poorten (contrast en structuur op nul in beide staten, de springlink, het ondertitelregister, en elk raakvlak minstens 24x24 op telefoonformaat) staan erin met wat ze tegenhouden; daaronder staat per mens waar het ophoudt. De belangrijkste zin is de laatste: er is nog nooit iemand met een handicap door dit huis gelopen, dus alles wat daar staat is gemeten met een browser en niet met een mens.
**`PROOF.md` is het diepte-document van de vertrouwenslaag** (werknaam RTG
ProofOS): vertrouwen als levende uitkomst in plaats van instelling. De
hoofdregel staat in paragraaf 0 en is mechanisch: **altijd voor de 100%, nooit
minder** -- bewijs mag alleen groeien en schuld alleen krimpen (normtanden
`bewijsCellenBewezen` en `bewijsAchterstand`), en elke afwijking heeft een naam,
een reden en een sluitweg in BEWIJSSCHULD.json. Lees vooral paragraaf 9, de
grenzen: bewijs is nooit een verhaal, degraderen is nooit stil, en niemand zet
een vervalstaat met de hand op bewezen. `scripts/vertrouwen.js` meet de
vervalstaten per route.

**`FABRIC.md` is het richtingsdocument van de laag BOVEN PROOF** -- de AI
Execution Fabric: van software bedienen naar een doel uitspreken. De zin die de
architectuur draagt: **een onbewezen handeling staat niet in de lijst waaruit de
AI kiest** (proof-aware routing; de bewijspoort in `server/kern/stuur/beleid.js`
laat een geschorste capability uit `toegestanePaden` vallen). Lees vooral
paragraaf 5, de grenzen: de AI kan nooit meer dan de persoon die hem iets vraagt,
geld verlaat het huis nooit vanzelf, wat een tweede persoon bereikt bevestigt een
mens, en autonomie wordt gepromoveerd en nooit geslopen.

**`EXECUTIE.md` is de laag eronder** -- de RTG Execution Plane: niet "we moeten
een veilige AI-executielaag ontwerpen" maar "we hebben meerdere volwassen
executiemechanismen die nog niet als een platformwaarheid functioneren". Lees die
voor je iets bouwt dat bepaalt of een handeling mag, hoeveel bevestiging hij
vraagt, of hij te herhalen is of hoe hij terugdraait. De kern in een zin: **een
scherm, een automatisering, de commandbalk, een AI-agent, een externe aanroep en
een geplande taak leveren allemaal intentie -- alleen de execution plane
veroorzaakt effecten.** Het opent met de gezagsvraag: `kern/command/risico.js`
rekent per geval uit of iets `hand`, `assist` of `auto` mag (met de score-opbouw
erbij, want een cijfer zonder opbouw is een orakel), terwijl `kern/stuur/beleid.js`
er naast staat met 21 patronen `direct` en 27 `voorstel`, vast per route en
ongeacht bedrag. **Het zijn er trouwens vijf en geen twee** -- `scripts/gezag.js`
registreert vijf gezagsvocabulaires plus 22 losse niveaunamen -- en ze botsen
vandaag NERGENS: van de 120/40/16 AI-bedienbare paden is er geen enkele een
Command-route. Dat is geen geruststelling maar een tijdvenster, want PLAN heeft
die kruising nodig. De eerste opdracht is daarom semantische consolidatie en geen
featurewerk. Vijf van de zeven "grote sprongen" blijken al gebouwd, alleen voor
de ops-cockpit: voor- en nacontrole (`command/transactie-poorten.js`, waar *een
controle die niet kon draaien niet geslaagd is* en de verificatie POSITIEF
nakijkt), de transactie met terugweg, de zandbak die uit de zaaiset draait en
niet uit productie, de simulatie met haar aannames in de uitslag, en het
ketenspoor van `kern/envelop.js`. Echt ontbrekend zijn er vier: **PLAN als
object**, de capability-compiler, het mandaat, en de optimizer zelf. Zes grenzen
bovenop die van FABRIC.md, waarvan de drie scherpste: een **mandaat verleent
nooit vermogen** maar versmalt alleen bestaand bewezen vermogen (de speelruimte
is een doorsnede en geen optelsom), **voorbereiden, verplichten en betalen zijn
drie gebeurtenissen** die er als een knop uitzien terwijl GELD.md erboven staat,
en de **executiekaart is een projectie en nooit een bron** -- wie hem met de hand
kan bijwerken heeft de 22e capabilitylijst gemaakt. Let op par. 5 voor je een
volgorde kiest: `VERTROUWEN.json` staat op **0 bewezen, 0 geschorst en 4180
verzwakt**, dus de bewijspoort houdt vandaag niets tegen en de regel "onbekende
uitvoeringssemantiek krijgt nooit maximale autonomie" zet nu ALLES op het
minimum -- die hoort dus eerst in de schaduw te lopen. De stuurmaat is niet
"wanneer hebben we Mijn AI" maar **wanneer kan RTG een volledige keten
bewijzen**; par. 7 zet er een van vier routes klaar, met per route gemeten wat
er nog aan ontbreekt en waarom (twee zijn ongemeten omdat de proef geen
gekoppelde groothandel had, niet omdat ze riskant zijn). **Blok 0 staat**
(`server/kern/stuur/resolver.js`): de tool `kaart` geeft niet langer alles wat
een rol mag maar de paden die DEZE opdracht raken -- **het succescriterium is DEKKING en
niet compactheid** -- liever veertien relevante paden dan drie waarvan de juiste
ontbreekt. Daarom twee meters en met opzet geen samengesteld cijfer
(`npm run resolver`, over 27 zinnen in negen taalvormen): versmalling 89% kleiner
(werkveld 8,8 paden) en **dekking 100%**, en het script eindigt met een foutcode
zodra die dekking zakt. De dekkingsmeter verdiende zich meteen terug met drie
gemiste vermogens, waaronder een zin met twee typefouten die naar EEN pad
versmalde dat er niets mee te maken had -- daaruit volgt de regel *dun bewijs is
geen bewijs*: raakt maar een woord iets terwijl de vraag er drie draagt, dan gaat
de volledige lijst terug. **Blok 2 staat als MEETLAAG en niet als beslisser**
(`scripts/gezagsnoemer.js`, `npm run gezagsnoemer`): een vier-tredige noemer
(`geen` / `tonen` / `klaarzetten` / `uitvoeren`) waarin alle vijf schalen worden
verklaard -- 16 treden evident met een citaat dat letterlijk in de bron moet
staan, 3 aangenomen en 1 ONBEPAALD. Die laatste is de scherpste: `direct` in de
AI-allowlist betekent "lezen OF een kleine omkeerbare handeling", en dat zijn twee
noemertreden in een woord. De noemer beslist met opzet niets en woont daarom in
`scripts/`; `test/gezagsnoemer.test.js` zakt zodra iets uit `server/` hem
importeert, want dan is hij de zesde gezagsschaal in plaats van de laag
eroverheen. **De vier besluiten zijn genomen (31 augustus 2026)** en de noemer staat op 18
evident, 3 besloten, 0 open. Drie ervan hebben dezelfde vorm: wat de machine mag
is een vraag, hoe ver hij mag gaan is een tweede -- `autonoom` en `begrensd`
blijven daarom eigenschappen (van het mandaat, van de uitvoering) en worden geen
trede. De vierde is in code uitgevoerd: **`direct` is gesplitst in `lezen` en
`klein`** (`kern/stuur/beleid.js`), en dat legde vijf routes bloot die in de
lezen-lijst stonden en aantoonbaar schrijven -- mediaos/stuur en /volg,
leerstof/oefen en /antwoord, en bijles/vraag. De splitsing verplaatst geen
bevoegdheid: `lezen` + `klein` is exact de oude `direct`, en
`test/stuur-niveaus.test.js` houdt dat vast met de oude lijst er letterlijk in
overgeschreven. **De dekking van de resolver wordt inmiddels GEGENEREERD gemeten**
(`npm run resolverbereik`): een vraag per toegestaan pad in zeven vervormingen --
1232 proeven, dekking 100%, en het corpus groeit mee met het platform in plaats
van met de pen van wie het opschreef. Dat vond meteen 17 verborgen vermogens: de
afkapgrens van vijftien sneed midden in een GELIJKE score, dus /api/bank/pas/betaal
viel op alfabet af terwijl /api/bank/advies bleef. Een gelijke score afkappen is
willekeur, en willekeur verbergt een vermogen zonder dat iemand het merkt.
**En meetgetallen in de documenten verouderen niet meer**: `npm run getallen`
schrijft ze tussen merktekens uit de registers (`<!--getal:idem.ongemeten-->3079<!--/getal--> randen,
<!--getal:verstrengeling.onverklaard-->0<!--/getal--> onverklaard — en dát getal moet naar nul, niet het
aantal randen), de activering per functie, de deltapoort die er niets bij laat
komen, de tredeproef over alle zeven treden van LAUNCH.md (0 lekken), en de
wekkers (<!--getal:wekkers.onverklaard-->0<!--/getal--> die geen enkele functie raken). Drie dingen daar
niet wegpoetsen: **een knoop is laag + domein en nooit domein alleen** (zonder de
laag lijkt een ingang die zijn eigen domein aanroept de zwaarste verstrengeling
van het huis), **de require-graaf ziet de kern-tas niet** (de meeste
route-bestanden hebben nul requires en krijgen hun domein via `(kern) => ...`),
en de tredeproef geeft **twee uitslagen die nooit worden opgeteld** — zuiver
(compleet, bewijst de bedrading niet) en beproefd (bewijst de bedrading, kan niet
compleet zijn). Dat verschil vond meteen een webhook die 200 gaf terwijl zijn
functie uit stond.

**`LAT.md` is de technische lat** — elf regels die allemaal uit een fout komen die hier écht is gemaakt, met per regel wat hem handhaaft en waar er alleen op mensen wordt vertrouwd. Lees die vóór je code schrijft of repareert. De belangrijkste twee: repareer de oorzaak en niet het symptoom, en trek elke bewering na met een mutatie (een toets die je niet hebt zien zakken is geen toets). LAT.md gaat over de code, CLAUDE.md over het merk.

## Structuur en starten (kort)

- `public/` — de webroot: `apps/` (portaal, PWA-app, leverancier, backoffice; 182 schermen), `apps/foundation/` (de RTFoundation, 71), `apps/juridisch/` (3), `site/` (alleen `404.html`), `shared/` (i18n, realtime), `fonts/`, `campagne/`, `sw.js` + `manifest.webmanifest` (PWA). **Er is geen `index.html` en geen marketingsite**: wie naar `/` gaat krijgt `/apps/app.html` via een interne herschrijving in `server/middleware/voordeur.js` (bewust geen 302, zodat de nonce-laag er gewoon overheen gaat), en die pagina draagt de inlogpoort zelf. Je komt dus direct bij de inlog
- `server/` — Node/Express-backend: `server.js`, `accounts.js` (identiteitskluis + codenamen), `db.js`/`seed.js`, `data/` (runtime: db.json, rtg.db, sleutels — **staat in .gitignore, nooit committen**)
- Starten: `npm start` (vereist Node 22.13+; `node:sqlite` laadt sinds die versie zonder vlag, dus `--experimental-sqlite` is overal weg) → http://localhost:3000
- AI is optioneel en lokaal-eerst: regelwerk en controleerbare extractie gebruiken geen model; vrije verrijking loopt bij voorkeur via `LOCAL_AI_URL`. `RTG_EXTERNE_AI_UIT=1` sluit externe modellen hard af. Zonder model blijven alle kernprocessen in handmatige werkmodus beschikbaar. Sleutels nooit in de repo of client-side JS zetten.
- `server/data/db.json` verwijderen = terug naar de seed-data. Sleutels (`secret.key`, `vault.key`) worden automatisch aangemaakt.

## Geschiedenis

De eerdere **statische versie** (losse HTML-bestanden in de root + Vercel `api/chat.js`) is vervangen door deze Express-versie. De laatste stand ervan staat in de git-historie (commit `b0baef8`, juli 2026) — niet terughalen tenzij expliciet gevraagd.

## Merkregels — ALTIJD toepassen

### Kleuren (exact uit het logo, nooit wijzigen zonder expliciete opdracht)
```css
--white:#FFFFFF
--black:#0C0C0B
--burgundy:#7F1634        /* primaire accentkleur */
--burgundy-bright:#9E1C40 /* hover-states */
--burgundy-on-dark:#C23A5E /* tekst op zwarte achtergrond */
--gold:#857007
--line:#DEDBD5            /* dunne scheidingslijnen */
--grey:#4D4A45            /* lopende tekst */
--grey-soft:#8A8680       /* onderschriften/meta */
```

**Regel: bordeaux is een accent, nooit een tekstkleur op zwarte achtergrond** (te weinig contrast). Op zwart: wit of `--burgundy-on-dark` — maar `--burgundy-on-dark` is zelf óók een accent en haalt op `--black` **3,78:1**: genoeg voor grote tekst (WCAG AA vraagt 3,0 vanaf 24px, of 18,66px vet), te weinig voor lopende tekst en kleine labels (4,5). Voor kleine tekst op zwart is het dus **wit**. Gemeten op 17 augustus 2026, toen de a11y-scan over alle 258 schermen ging; `--grey-soft` haalt daar 5,41 en is wel goed, `--grey` haalt 2,22 en hoort niet op zwart.

### Typografie
- **Bodoni Moda** voor koppen/display
- **Inter** voor functionele tekst (nav, knoppen, chat-UI, formulieren) en lopende tekst
- Beide **zelf gehost** in `public/fonts/` (woff2 + `@font-face` in `public/fonts/fonts.css`), niet van Google Fonts of een andere CDN. De CSP staat dat ook niet toe (`default-src 'self'`, `font-src 'self'`), dus een externe font-link laadt gewoon niet. Zelfde lettertypes, alleen niet van een vreemde server.
- In deze versie wordt **geen EB Garamond** meer geladen (dat was de body-font van de oude statische versie) — niet opnieuw introduceren, en ook geen andere fonts toevoegen zonder overleg

### Design-principes
1. **Premium, ook aan de onderkant.** RTG Pass is de instap, maar mag nooit budget aanvoelen.
2. **Eén signatuurelement, geen stapeling van trucjes.** Niet steeds nieuwe visuele devices toevoegen.
3. **Stark zwart/wit ritme**, geen beige/marmer-gradients, geen ronde hoeken of gouden randjes.
   *Sinds 20 augustus 2026 ook in code:* elke `border-radius` in `public/` is `0`.
   De vormtaal deed jarenlang het tegenovergestelde (18px op kaarten, 12px op
   velden, 999px op knoppen, plus 195 losse pixelwaarden die zich aan geen van
   beide hielden); 3169 hoeken zijn omgezet. **Eén uitzondering: een cirkel is
   geen hoek.** Een statusstip, een monogram of een avatar is een vorm en geen
   afgeronde rechthoek, dus `border-radius:50%` mag — en dat is de enige waarde
   naast `0` die er nog voorkomt. `scripts/check.js` regel 51 houdt het zo; een
   merkregel die alleen in dit document staat, is over een half jaar weer weg.
4. **Veel lucht** — genereuze verticale padding; bij twijfel meer ruimte.
5. **De Salon levert het beeld.** Site- en campagnebeeld zijn uitgelichte Salon-posts (featured, altijd met naamsvermelding — label "Uit De Salon · naam"; endpoint `/api/salon/promo`, alleen featured posts, RTG cureert). De onderliggende demo-beelden zijn AI-gegenereerd in eigen huis (`public/campagne/`, via Pollinations; quiet luxury, gedempte tinten, géén mensen) — geen stockfoto's, geen modellen, geen extern beeld. Overige visuals met CSS/SVG bouwen.

### Tone of voice — verschilt per pass, bewust zo
- **RTG Pass**: "old money" — ingetogen, zeker, "je/jij"-vorm
- **Lifestyle Pass**: "vertrouwde rechterhand" — voorkomend, "u"-vorm
- **Business Pass**: "efficiënte strategische partner" — zakelijk, scherp, "u"-vorm

### Toegangs- en AI-regels (gelden ook voor system prompts)
- **RTG Pass**: voor iedereen, na de "ballotage" (AI-intake); volledig AI-gedreven klantcontact
- **Lifestyle & Business Pass**: uitsluitend na menselijke goedkeuring of op uitnodiging — de AI mag **nooit** zelf toegang beloven of verlenen
- Nooit echte hotel-/luchtvaartmerken als bevestigde partners opvoeren; nooit claimen dat een boeking daadwerkelijk verwerkt is
- **Privacy by design (codenamen)**: klantdata draait op codenamen, echte namen staan in de gescheiden kluis (`accounts.js`) — dit ontwerp niet omzeilen
- **Fiscale uitspraken zijn geklasseerd, niet vlak.** Elke fiscale uitkomst droeg dezelfde zin — "voorlichting, geen bindend fiscaal advies" — en die stond zowel onder een btw-aangifte die tot op de cent uit het factuurregister is geteld als onder een zzp-schatting op een verwachte jaarwinst. Dat doet allebei tekort en wordt na een week niet meer gelezen. Er zijn nu vier klassen (`server/kern/fiscaal/zekerheid.js`): **bepaald** (wet + gegevens leiden eenduidig tot deze uitkomst; mag als feit worden gepresenteerd), **uitlegbaar** (meerdere verdedigbare behandelingen; wij kiezen er één en zeggen welke en waarom), **advies** (wij rekenen voor, een mens met vakkennis beoordeelt) en **voorbehouden** (dit mag RTG juridisch of procedureel niet zelfstandig doen). De regel eronder: **automatiseer wat objectief automatiseerbaar is, en maak nergens zekerheid waar die niet is.** Drie dingen mogen niet sneuvelen: een uitkomst die niemand heeft ingedeeld valt terug op de vóórzichtige klasse en zegt dat hij niet is ingedeeld (nooit stilzwijgend "bepaald"); `voorbehouden` is een grens en geen nog-te-bouwen functie — indienen namens een ondernemer, een boete opleggen, een naheffing vaststellen en toegang tot een pas beloven staan er alle vier in; en `bepaald` betekent "over de uitkomst is geen discussie als de gegevens kloppen", niet "gegarandeerd juist" — waarvoor de bewijsketen (`kern/fiscaal/herkomst.js`) laat zien waar het getal vandaan komt. Deze klassen gelden ook in system prompts: een AI-antwoord over de boekhouding sluit af met de zin van zijn klasse en niet met een zelfbedacht voorbehoud.
- **De zaak wordt gecontroleerd én de mens.** Acht genres houden de ZAAK tegen tot een medewerker een vergunning heeft gezien (`server/kern/aanmeldingen/bewijs.js`); daarnaast vraagt een genre iets van de PERSOON die er werkt — `server/kern/persoonseis.js`, met de stukken in `server/kern/vakbewijs.js`. Twee reikwijdtes: **werk** houdt de sessie tegen (kinderopvang, beveiliging, hulpdiensten — ook voor de manager, want juist de vrijstelling voor de baas is de deur waar een fraudeur op mikt), **handeling** houdt alleen die handeling tegen (voorschrijven, verwijzen, uitreiken). Een balie van een huisartsenpraktijk werkt dus gewoon en schrijft niets voor. Het documentNUMMER woont in de identiteitskluis (`member_state`, versleuteld en gebonden aan de rij) en niet in de operationele data: een BIG-registratie staat in een openbaar register, dus een nummer naast een codenaam voert die codenaam terug naar een echte naam. Het kantoor opent dat met een verplichte reden, een regel in het inzagejournaal en bericht aan de betrokkene; zelf-inzage gaat vrij. Drie regels die niet mogen sneuvelen: een ingediend stuk is geen bewijs (een mens van RTG tekent af, en nooit de werkgever zelf), een stuk verloopt en wordt bij élke vraag opnieuw gerekend, en RTG valideert niets inhoudelijk — wij bellen het BIG-register niet en doen niet alsof. Een handeling in het register die nergens wordt afgedwongen, laat `test/persoonseis.test.js` zakken.

## Wat NIET te doen

- **Geen marketingsite terugbouwen.** De publieke marketingpagina's zijn er bewust uit; `/` komt direct op de inlog uit. Een landingspagina, "over ons", een prijzenpagina of een publieke homepage is dus geen ontbrekend stuk dat je even aanvult — het is een besluit. Alleen terugbouwen als daar expliciet om gevraagd wordt
- Geen "verslavende" engagement-patronen (kunstmatige urgentie, oneindige scroll-tricks)
- **De progressielaag stopt bij 18+.** Alles wat een prestatie bewaart búiten het potje — highscores, ranglijsten, niveaus, prestaties, toernooien, seizoenen — bestaat alleen voor leden die de 18+-poort halen (`volwassen()` in `server/kern/volwassen.js`: een eigen account, door RTG gekeurd — betrouwbaarheidsniveau A3, het identiteitsbewijs is gezien — én 18 of ouder). Onder die grens blijft elk spel volledig speelbaar; er wordt alleen niets van bewaard. De Arena belooft tieners met zoveel woorden "alles telt alleen binnen het potje; er bestaat geen ranglijst", en School houdt vast aan "leren is geen wedstrijd". De grens staat op één plek in de code (`progressieMag` in `server/kern/spellen/grens.js`, die `volwassen()` leest); nieuwe progressievormen hangen daaraan en krijgen geen eigen kopie van de regel. Let op de tweede helft: de gecontroleerde geboortedatum komt pas van het document als de keurder hem bij de goedkeuring overneemt (`server/routes/office/verificaties.js`). Doet hij dat niet, dan is de identiteit wél gezien maar staat de datum nog zoals het lid hem opgaf; RTG iD en de stempoort tonen dat verschil met `leeftijdBron`.
- Geen nieuwe kleuren of fonts zonder de merkregels hierboven te checken
- `server/data/` (database, sleutels) en `.env` nooit committen
- Bij CSS-zoek-vervang: daarna clamp()/calc()-waarden en brace-balans controleren (eerder misgegaan)

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen hele bestanden herschrijven. Laat zien wat er verandert voordat je doorpakt naar de volgende pagina.

**Vragen stellen doe je met meerkeuze.** Moet je iets weten, stel dan geen open vraag maar geef opties waar je uit kunt kiezen, met per optie wat het betekent en wat het kost. Zet je eigen aanbeveling vooraan. Dat scheelt heen-en-weer en maakt zichtbaar welke keuzes er werkelijk zijn.
