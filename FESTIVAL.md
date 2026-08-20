# FESTIVAL.md — RTG Festival, een tijdelijke stad

Het diepte-document voor de wereld die een festival draait. `PLATFORM.md`
beschrijft het wereldpatroon dat elke wereld krijgt en de super-app-regel die
bepaalt wat er samen mag; `GELD.md`, `LEVEN.md`, `LIFE.md` en `CONCERN.md` zijn
de zusterdocumenten; `LAT.md` zegt hoe hier geschreven wordt. Dit zegt wat deze
wereld is, hoe hij op de bestaande motoren staat, en — zwaarder wegend — wat hij
nooit mag worden.

---

## 0. De kern, in een zin

> Een festival is geen evenement met een kaartverkoop eromheen. Het is een
> **stad die drie dagen bestaat**: met een bevolking, een vervoersnet, een
> horecasector, een nutsvoorziening, een hulpdienst, een handhaving, een
> arbeidsmarkt en een begroting — en dan weer verdwijnt.

RTG draait de permanente stad al. Gemeente en vergunningen, meldkamer en
rampbeeld, beveiliging met rooster en PDA, horeca met keuken en kassa, de
handelsketen, de pendeldienst, personeel met klok en loonrun, de identiteitskluis
met codenamen. Wat ontbreekt is niet een van die motoren. Wat ontbreekt is de
**klok en het terrein waaronder ze even samen één ding zijn**.

Daaruit volgt de regel die het hele ontwerp stuurt:

> **RTG Festival bezit bijna niets en dirigeert bijna alles.** Elke functie die
> ergens in RTG al draait, blijft daar draaien. Deze wereld voegt drie dingen
> toe die nergens anders kunnen wonen: het terrein, de rechten, en de vooruitblik.

---

## 1. Dit is geen groen veld — en dat is hier het belangrijkste feit

Van de vijfendertig onderdelen die deze wereld vraagt, staat het merendeel er al.
Niet als idee maar werkend, met toetsen eronder. Ze staan alleen los van elkaar
en ze kennen geen festival.

| Wat een festival vraagt | Wat er al staat | Waar |
|---|---|---|
| vergunningen | evenement-, terras-, horeca- en standplaatsvergunning; aanvraag → voorwaarden → verleend wordt openbare bekendmaking | `kern/gemeente/vergunningen.js` |
| beveiligingsinzet | rooster met autoplanner (rust tussen diensten), urenbudget tegen contract, inzetaanvragen per object en shift, bewakers-PDA met GPS-inklok, checkpoints, incident met foto, SOS | `kern/beveiliging/` |
| meldkamer | eenheden over land, water, lucht en heli; prioriteiten; keten gemeld → toegewezen → ter plaatse → afgerond; bijstand tussen korpsen | `kern/hulpdienst/meldkamer.js` |
| opschaling | gezamenlijk rampbeeld over korpsen, ziekenhuisbedden en defensie | `kern/rampbeeld/` |
| draaiboek | runsheet per station (keuken, bar, bediening, party), sorteren over middernacht, MEP-fallback, geplakte tekst omzetten | `kern/events/draaiboek.js` |
| horeca-exploitatie | dertien rekeningkanalen waaronder `event` en `foodtruck`, gangen, splitsen, offline-wachtrij | `kern/horeca/` |
| cashless | polsbandtegoed: saldo nooit onder nul, restsaldo terug, **geen naam op de band** | `apps/horeca/club-band.js` |
| kassa per werkvorm | modus `discotheek` (deurverkoop + 18+-herinnering), `sportkantine` (vrijwilligers) | `routes/supplier/kassa/modus.js` |
| personeel | weekrooster, geklokte uren, loonrun, vertrouwenslijn buiten de werkgever om | `kern/personeel.js`, `kern/payroll/` |
| vakbekwaamheid | acht genres met bewijsplicht; beveiliging vraagt een vergunning van de ZAAK én van de MENS, reikwijdte *werk* | `kern/aanmeldingen/bewijs.js`, `kern/persoonseis.js` |
| inkoop en levering | één keten: aanvraag → offerte → gunning → planning → levering met bewijs → factuur → betaling, gericht op een **genre** en niet op een adres | `kern/handelsketen.js` |
| pendelvervoer | een werkgever zegt wat hij wil, het systeem maakt er een dienstregeling met zitplaatsen van | `kern/mobiliteit/pendel.js` |
| het moment bij de bezoeker | bij een bijeenkomst wordt klaargezet wat erbij hoort (tafel, vervoer, verblijf, kaart) — en er wordt **nooit** geboekt | `kern/objectlaag/eventwereld.js` |
| de onderneming eromheen | concern, entiteit, registratie, vestiging, merk, operating unit | `kern/concern/` |

**De opgave is dus niet uitvinden maar dirigeren.** Wie hier begint met bouwen
en een van deze regels overschrijft, bouwt de tweede waarheid die LAT-regel 4
verbiedt — en verliest bovendien wat de bestaande laag al wist.

---

## 2. Waarom een festival vandaag niet past, en waarom "de getallen omhoog" het antwoord niet is

Een festival is nu een `activiteit` van een zaak (`routes/supplier/tickets.js`).
Dat model heeft vier harde grenzen:

1. capaciteit **maximaal 500** per tijdslot;
2. **twaalf** tijdslots en **dertig** activiteiten per zaak;
3. check-in weigert elk kaartje dat niet voor **vandaag** is;
4. de entreecode wordt **ingetypt**, niet gescand.

De verleiding is die vier getallen te verhogen. Dat is de verkeerde reparatie, en
LAT-regel 1 zegt waarom: dit zijn symptomen. De oorzaak is dat een activiteit
**één ding op één moment op één plek** is, en een festival vier dingen tegelijk:

- het duurt **meer dan een dag**, en een recht kan op dag twee wél en op dag drie
  niet gelden;
- het heeft **een terrein met binnenwerk** — een camping naast een mainstage
  naast een backstage, elk met een eigen deur en een eigen telling;
- één aankoop draagt **tientallen rechten**, waarvan sommige van elkaar afhangen;
- het draagt **crew, artiesten en leveranciers** die door dezelfde poorten gaan
  met totaal andere rechten.

Geen van die vier is een getal. Ze vragen alle vier een object dat er nog niet is.

---

## 3. Het kernmodel

```
festival → editie → dag → terrein → plek → sessie
```

Met daarnaast de **pas**, die rechten draagt, en de **uitzondering**, die de
vooruitblik draagt.

### 3.1 Plek is één vorm, geen twee

De verleiding is zone en object te scheiden: een zone heeft bezoekers, een object
is een ding. Dat is fout, en de kosten zijn concreet. Een mainstage heeft
capaciteit. De zone eromheen heeft capaciteit. De camping heeft capaciteit. De
toiletcluster heeft doorvoer. Wie daar twee soorten van maakt, schrijft elke
capaciteitsregel, elke telling, elke drempel en elke uitzondering **twee keer** —
en dan lopen ze uit elkaar, want dat doen twee kopieën altijd.

Dus: **één vorm `plek`, met een soort en een ouder.** Een terrein is een plek
zonder ouder. Een zone is een plek in een terrein. Een podium is een plek in een
zone. Een bar is een plek in een zone. De boom is zo diep als het festival is.

Wat een plek draagt: `soort`, `ouder`, `capaciteit`, `veiligeCapaciteit`, en of
hij **telt** (een podium telt bezoekers; een generator niet).

Dat de veilige capaciteit apart staat van de capaciteit is geen verfijning maar
de kern van het veiligheidswerk: de vergunning noemt een maximum, de
veiligheidsorganisatie noemt een lager getal waarbij je al moet ingrijpen, en het
verschil tussen die twee is precies de tijd die je hebt.

### 3.2 Een dag is een object, geen datum

Een festivaldag heeft een opening, een sluiting en een **curfew** die niet
dezelfde is als de sluiting. Hij kan over middernacht heen lopen — `draaiboek.js`
weet dat al en sorteert er goed doorheen; die kennis wordt hier gebruikt en niet
nagebouwd.

### 3.3 De pas draagt rechten, geen type

Dit is de grootste hefboom in het hele ontwerp, en hij is de moeite van het
uitschrijven waard.

Een kaartje heeft vandaag een *type*. Elk nieuw product is dan code: een
weekendticket is een nieuw type, een weekendticket met camping weer een, met
shuttle weer een. Dat is de N²-val die `PLATFORM.md` op drie andere plekken al
heeft gekost.

In deze wereld draagt een pas **rechten**:

```
festival.entree      dag 1,2,3
camping.premium      dag 1..3, plek camping-noord
entree.fastlane      alle dagen
vip.dek              dag 2, plek alpha-dek, 13:00–19:00
locker.groot         dag 1..3, plek locker-west
shuttle.amsterdam    dag 1 heen, dag 3 terug
```

Een recht is: **een soort, een bereik (welke dagen, welke plek), een venster
(van–tot) en een voorwaarde.** Meer niet. Een product is een verzameling rechten
met een prijs eromheen — dus **data en geen code**. Een nieuw pakket verzinnen is
dan een regel in een tabel, niet een release.

En het maakt de crewkant gratis: een technicus draagt dezelfde vorm pas met
andere rechten. Eén poort, één scanner, één weigeringszin — voor 65.000
bezoekers, 4.000 crew en 300 artiesten.

**Rechten geven; er is niets dat ontzegt — en dat vraagt één begrip erbij.** Een
model met zowel toekennen als verbieden krijgt vroeg of laat een verbod en een
toekenning over dezelfde plek, en dan moet iemand raden welke wint. Maar zonder
tegenwicht opent een recht op "het hele terrein" ook backstage.

De oplossing is een eigenschap van de **plek** en niet van het recht: een plek
kan **besloten** zijn, en dan erft hij niet. Een recht opent hem alleen als het
die plek zelf noemt, of iets dat erin ligt. Backstage, een crewzone, een VIP-dek:
precies de plekken waar een algemeen kaartje niet hoort te komen. Eén vlag, geen
tweede mechanisme.

**De voorwaarde is waar dit huis zijn eigen laag in vindt.** Een recht kan hangen
aan bewijs dat elders al leeft: de veiligheidsinstructie is afgevinkt, het
vakbewijs is afgetekend en niet verlopen (`kern/vakbewijs.js`), de leeftijd is
gecontroleerd tegen het paspoort. Backstage Alpha op zaterdag van 13:00 tot 19:00,
*mits* de instructie is gevolgd, is dan geen procedure in een map maar een recht
dat vanzelf niet opent.

---

## 4. Het werkwoord van deze wereld

`PLATFORM.md` eist dat wie een nieuwe wereld bouwt het werkwoord van de vierde
laag **kiest en opschrijft voordat hij begint**. RTG Geld voert uit binnen regels
en binnen het eigen tegoed. RTFoundation opent alleen en stuurt nooit. RTG Sociaal
stelt samen en zet klaar; bevestigen doet de mens.

Voor deze wereld:

> **Voorspellen en klaarzetten. Ingrijpen doet de mens — behalve binnen een
> grens die getekend is vóórdat de poorten opengingen.**

Waarom die staart eraan zit, en waarom hij gevaarlijk zou zijn zonder de rest:

Op een festivaldag is er voor sommige dingen geen tijd om te vragen. Een krat
bier dat van bar B naar bar A moet, een extra runner, een bord dat een andere
route wijst: wie daar om negen uur 's avonds een akkoord voor moet zoeken, heeft
het probleem al. En voor andere dingen is er **altijd** tijd om te vragen, hoe
druk het ook is: een route sluiten, een zone dichtzetten, ontruimen, een artiest
omboeken, een grote terugbetaling.

De oplossing is niet de AI laten wegen hoe erg iets is. Dat is precies de
beoordeling die je niet aan een model geeft. De oplossing is dat een **mens met
een naam de grens tekent terwijl het nog rustig is** — dagen van tevoren, in het
beleid — en dat die grens een **gesloten lijst** is. Niet "alles wat niet
verboden is", maar "deze zeven handelingen, en verder niets". Wat er niet op
staat, wacht op een mens, ook als het systeem zeker weet dat het goed zou zijn.

En één handeling staat er **nooit** op, ook niet als de eigenaar hem erop wil
zetten: ontruimen. Zie par. 5.3.

---

## 5. DE GRENZEN. Dit deel weegt zwaarder dan par. 1–4

Een festival is de plek waar elke privacybelofte van dit huis onder de meeste
druk staat, want de verleiding is er het grootst en de rechtvaardiging klinkt er
het best. "Het is voor de veiligheid" is waar, en het is precies waarom deze
paragraaf bestaat.

### 5.1 Een bezoeker is een telling, geen spoor

Crowd Intelligence telt **mensen per plek**. Het volgt geen mens tussen plekken.

Het verschil is niet academisch. Voor elke operationele beslissing die deze
wereld neemt — corridor C loopt vol, Alpha zit op 91%, de uitstroom komt om 22:54
— is een **aantal per plek per minuut** genoeg. Een route van persoon 4471 over
het terrein voegt daar operationeel niets aan toe en levert wel een dossier op
over waar iemand met wie stond.

Dus: bezetting, instroom, uitstroom, dichtheid, voorspelling — allemaal
**opgeteld**. De scan aan de poort weet welke pas binnenkwam (dat moet, anders
kan een pas twee keer naar binnen); de telling per zone daarbinnen weet alleen
hoeveel. En de codenaamregel van dit huis geldt onverkort: wat er in de
operationele data staat is een codenaam, de echte naam staat in de kluis
(`accounts.js`).

### 5.2 Geen gezichtsherkenning. Geen biometrische poort

Niet als optie, niet als module die een klant kan aanzetten, niet "voor VIP-gemak".
Dit staat hier omdat het de eerste functie is die een festivalleverancier
aanbiedt, en omdat een systeem dat gezichten aan codenamen kan koppelen de hele
kluisconstructie van dit huis in één stap ongedaan maakt.

### 5.3 De AI ontruimt nooit, en sluit nooit zelf een route

Ontruimen is de handeling waarbij een fout niet terug te draaien is: een
paniekgolf van 13.000 mensen door een corridor die je zelf hebt aangewezen. Die
handeling hoort bij een mens die verantwoordelijk is en die 's nachts wakker ligt
van dat besluit.

De AI mag: het **voorstellen**, met bewijs, zo vroeg mogelijk, met de gevolgen
uitgerekend. De AI mag: de mens die het besluit neemt alles klaarzetten wat hij
daarna nodig heeft. De AI mag niet: het doen.

**Wat hier níet onder valt, en waarom dat geen sluiproute is.** Een draaihek dat
stopt bij de vergunde capaciteit sluit geen route — het telt. Dat getal is geen
oordeel van een model maar een grens die een mens heeft ondertekend voordat de
poorten opengingen, en de scanner voert hem alleen uit. Bij de *veilige*
capaciteit gaat er dan ook niets dicht: daar begint een uitzondering, en die gaat
naar een mens.

Hetzelfde geldt voor een route sluiten, een zone dichtzetten, en een poort
blokkeren. Deze drie plus ontruimen staan op de **gesloten lijst van vier** die
nooit in de handelingsruimte van par. 4 komen.

### 5.4 Marketing mag operatie nooit overrulen — en operatie is geen advies

De campagnelaag mag niets pushen wat operationeel onwenselijk is; als de camping
bijna vol zit stopt de campingcampagne. Dat is de regel die de gebruiker vroeg,
en hij is goed.

Maar de omgekeerde kant hoort er in dezelfde adem bij, anders is hij binnen een
jaar weg: **een operationele stop is een stop en geen signaal.** Er komt geen
knop "toch versturen" voor de commerciële kant, want die knop wordt gebruikt. Wie
hem echt nodig heeft, gaat langs een mens met een naam en dat komt in het
actielog.

### 5.5 Gereedheid kan niet groen gepraat worden

Een Festival Readiness Score van 98,7% is een mooi getal en daarom gevaarlijk.
`LAT.md` regel 11 gaat hier letterlijk over: bewijsgroen is geen go-live-groen.

Dus: elk procent komt uit een **control met bewijs** — een vergunning met een
nummer en een datum, een rooster met bezette posten, een keuring met een
handtekening. Een control zonder bewijs telt als **nul**, niet als "waarschijnlijk
in orde". En één ontbrekende kritieke control zet de hele stand op **NOT READY**,
ongeacht wat de andere 99 doen en ongeacht of de kaartverkoop al gelopen is.

Wie dat getal wil zien stijgen, haalt bewijs op. Er is geen andere weg erheen.

### 5.6 De meldkamer hier is geen 112

`PLATFORM.md` zegt het al voor de hulpdienst-genres, en op een festivalterrein
moet het nog een keer: dit is het **RTG-net** van de organisatie. Het vervangt
geen alarmnummer, en de app zegt dat zelf ook tegen de gast.

### 5.7 Crew-AI geeft geen medische instructie

De assistent van een medewerker mag het protocol herhalen dat de organisatie zelf
heeft vastgelegd, de melding doorzetten en de dichtstbijzijnde post noemen. Hij
verzint geen medisch advies, ook niet als het voor de hand ligt, en ook niet als
er niemand anders is. Dat is dezelfde grens die `PLATFORM.md` par. 5 al trekt.

### 5.8 Locatie delen is wederkerig, intrekbaar, en stopt vanzelf

Vrienden terugvinden op een terrein is een van de echte pleziermomenten, en het is
ook precies een volgsysteem als je het verkeerd bouwt. `LIFE.md` par. 4.6 heeft
de regel al: toestemming reist niet mee. Hier betekent dat: delen is per persoon,
wederkerig, altijd op te zeggen, en het **verloopt automatisch aan het einde van
de editie**. Er blijft geen band bestaan omdat twee mensen ooit samen op een
festival waren.

### 5.9 Het polsbandsaldo blijft van de gast

De bestaande regel geldt hier onverkort: saldo kan nooit onder nul, restsaldo kan
terug, en de knop om het terug te vragen is even groot als de knop om op te
waarderen. Een festival dat leeft van vergeten restsaldo is een festival dat zijn
gasten bestal, en dit huis levert daar de software niet voor.

### 5.10 Wat de organisator over een gast weet, weet hij omdat het gebeurd is

Het festivalprofiel draagt aankopen, edities, bestellingen — dingen die de gast
zelf gedaan heeft. Geen afgeleide gevoelens, geen scores, geen voorspelde
muzieksmaak die als feit wordt getoond. Next Best Action mag rekenen; wat er
uitkomt is een **aanbod**, en het draagt zichtbaar waaruit het volgt.

---

## 6. Het wereldpatroon, hier ingevuld

| Laag | Wat het hier is | De regel die hem eerlijk houdt |
|---|---|---|
| **graaf** | de festivalprojectie: terrein, passen, crew, voorraad, vervoer, meldingen — gelezen uit de domeinen die ze al bezitten | leest alleen; telt nooit zelf op wat horeca, beveiliging of mobiliteit al optelt |
| **beleid** | de drempels en de handelingsruimte: veilige capaciteit per plek, wanneer iets een uitzondering wordt, welke handelingen vanzelf mogen | door een mens met een naam getekend vóór de poorten open; de gesloten lijst van vier staat er nooit in |
| **cockpit** | Festival Command: uitzonderingsgestuurd, met voorspelling en aanlooptijd | rust is een uitkomst, geen leegte; wat goed gaat komt niet in beeld |
| **Rahul** | de gegronde stem, in drie standen: gast, crew, directie | rekent met echte cijfers, noemt zijn bron, en zegt "dat weet ik niet" als de meting ontbreekt |
| **actielog** | de tijdlijn van de editie: elke scan, elke inzet, elke beslissing, elk bewijs | groeit aan, wordt nooit herschreven — en is daarmee de reconstructie achteraf |

---

## 7. Wat er nieuw bij moet, en wat beslist niet

**Nieuw, want het kan nergens anders wonen:**

1. het **terrein** als boom van plekken met capaciteit en veilige capaciteit;
2. de **pas met rechten** — de entitlement-motor, en de scan eroverheen;
3. de **uitzonderingenmotor** — van toestand naar een gerangschikte lijst met
   aanlooptijd;
4. de **gereedheid** met controls en bewijs;
5. de **editie-tijdlijn** als één stroom.

**Niet nieuw, en dus expliciet verboden om na te bouwen:** rooster, loonrun,
meldkamer, vergunning, keuken, kassa, polsband, inkoopketen, pendeldienst,
facturatie, boekhouding, identiteitskluis. Wie daar iets van tegenkomt dat niet
past, repareert het in de bestaande laag — waar het voor iedereen beter wordt —
en niet met een festivalkopie.

---

## 8. De volgorde

Elke fase is los bruikbaar; niets hieronder vraagt de volgende fase om waarde te
hebben.

1. **Terrein en pas.** De boom van plekken, de rechten, de scan met
   dubbelgebruik-slot en de leesbare weigering. *Hiermee kan een festival zijn
   poorten draaien.*
2. **Command en uitzonderingen.** Bezetting, drempels, vooruitblik, de
   gerangschikte lijst. *Hiermee ziet de leiding wat over dertig minuten misgaat.*
3. **Gereedheid.** Controls met bewijs, NOT READY die niet weg te praten is.
4. **Crew.** Zero-search: dienst openen, route, briefing, één knop. Bovenop het
   bestaande rooster, niet ernaast.
5. **Commerce.** Producten als verzamelingen rechten, bundels met voorraadgrenzen,
   groepen.
6. **Artiest en podium.** Boeking, rider, changeover, settlement — met het
   draaiboek dat er al is.
7. **Voorspelling.** Horeca-, personeels- en vervoersvraag uit programma en flow.
8. **Geheugen.** Verwacht tegen werkelijk, per editie, als advies voor de volgende.

---

## 9. Wat dit niet wordt

- **Geen tweede platform.** Als deze wereld een eigen rooster, een eigen kassa of
  een eigen meldkamer krijgt, is het project mislukt, ook als het werkt.
- **Geen veiligheidskritieke besturing.** Geen aansturing van constructies,
  stroomnetten of nooduitgangen. Meten, waarschuwen en klaarzetten wel; bedienen
  niet.
- **Geen vervanger van de veiligheidsorganisatie.** Het advies van deze software
  is invoer voor een veiligheidscoördinator, niet zijn besluit.
- **Geen weersvoorspeller.** De weerlaag rekent gevolgen door van een voorspelling
  die ergens anders vandaan komt, en zegt erbij van wie.
- **Niet in één release.** Acht fasen, en elke fase moet los overeind staan.

---

## 10. De lat, hier

Vijf vragen. Niet "kan RTG een festival draaien", maar:

- **Gast** — kan iemand een heel weekend beleven zonder één keer organisatorisch
  gedoe?
- **Crew** — kan iemand zijn dienst draaien zonder WhatsApp, Excel, papier, of
  zoeken wie waarover gaat?
- **Leiding** — is binnen vijf seconden zichtbaar wat nú aandacht vraagt, en wat
  over dertig tot honderdtwintig minuten misgaat?
- **Veiligheid** — is elke belangrijke beslissing aantoonbaar, bevoegd,
  reproduceerbaar en zo veel mogelijk preventief?
- **Commercie** — wordt elke lege plek benut zonder de beleving stuk te
  optimaliseren?

En de zesde, die van dit huis is: **is er onderweg iets bijgebouwd dat al
bestond?** Als het antwoord ja is, telt de rest niet.
