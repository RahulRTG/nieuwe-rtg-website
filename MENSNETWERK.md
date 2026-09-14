# RTG Mensnetwerk

*De grondwet voor menselijke vertegenwoordiging: wie mag iets doen namens een
mens, wie mag iets over hem weten, en wie verdient aan welke keuze.*

`CARRIERE.md` staat hierboven en niet ernaast: dat beantwoordt wat de mens die
van zijn talent leeft in dit huis IS. `RUGDEKKING.md` beantwoordt één vraag
daaruit (hoe heet het geld dat naar zo'n mens gaat). Dit document beantwoordt de
twee die overbleven: **hoe komt hij binnen, en wie staat er naast hem** --
inclusief de vraag of RTG dat zelf mag zijn.

Lees dit vóór je een aanmeldweg, een vertegenwoordigingsmodel of een
RTG-managementdienst bouwt.

**De kern in één zin: geen organisatorische relatie met RTG kan menselijke
toestemming vervangen, verruimen, doorgeven of reconstrueren.**

Dat is de zin waar alles onder hangt, en hij is vandaag grotendeels waar zonder
dat iemand hem heeft opgeschreven -- par. 0.4 laat zien waar hij door de
architectuur wordt afgedwongen en waar hij alleen nog waar is doordat niemand
hem heeft doorbroken.

---

## 0. De zes metingen die vóór alles gaan

Gemeten op 13 september 2026, uit de bron. Dezelfde volgorde als bij `Asset`
(`OBJECTMODEL.json`) en de carrièrelus (`CARRIEREVORM.json`): eerst rekenen, dan
vinden.

### 0.1 De keten, en wat ervan staat

Dit document verving onderweg één keten door een andere, en die verschuiving is
de belangrijkste inhoudelijke beslissing erin.

    was:  mens → waarde → talentstatus → management → diensten
    is:   mens → behoefte → relaties → expliciete bevoegdheden → dienst → bewijs

De eerste keten begint met een oordeel van RTG over een mens. De tweede begint
bij wat die mens wil. Alles in par. 2.1 en 2.2 volgt daaruit: **een mens hoeft
niet door RTG beoordeeld te worden om toegang te krijgen tot het systeem.**

Van de zeventien onderdelen die het voorstel noemt:

| | Onderdeel | Stand |
|---|---|---|
| 1 | Profiel van de mens | **half** -- genre `talentmens` en zeven hoedanigheden staan |
| 2 | Intakegesprek | **half** -- `kern/aanmeldgesprek*.js` staat, kent dit onderwerp niet |
| 3 | Identiteit / A3 | **staat** -- `kern/betrouwbaarheid.js`, `/apps/verificatie.html` |
| 4 | Passkey | **half** -- `server/webauthn/` staat, hangt niet aan de zware handelingen |
| 5 | Persoonlijk beginscherm | **botst** -- er is er één (par. 2.4) |
| 6 | Kring van vertrouwen | **staat** -- `kern/vertegenwoordiging/`, 8 routes, eigen scherm |
| 7 | Loopbaanbewijs | **staat** -- `kern/carriereledger/`, 10 routes, 2 schermen |
| 8 | Bewijsmap | **staat, en het is de vondst van par. 0.3** |
| 9 | Rechtenregister | **bestaat niet** |
| 10 | Gelijkenisgrendel | **bestaat niet** |
| 11 | Rugdekking | **staat zonder scherm** -- par. 5.2 |
| 12 | Uitbetalen aan een mens | **een besluit, en géén datamodel** -- par. 2.5 |
| 13 | Voorstelkamer voor een merk | **half** -- `kern/commercie/voorstel.js` + `voornemen.js` |
| 14 | Werkblad voor een manager | **staat als gegeven** -- `ikSta` in `/api/vertegenwoordiging/mijn` |
| 15 | Eigen publiek | **half** -- De Salon, tickets, membership en merch bestaan los |
| 16 | Kansen matchen | **bestaat niet**, en de vorm is al beslist (`CARRIERE.md` par. 4.3) |
| 17 | Wat er overblijft na een carrière | **bestaat al, als afwezigheid** -- par. 2.1 |

Zes staan, vijf staan half, vier bestaan niet, twee zijn geen bouwwerk maar een
besluit of een grens. **De schatting "ongeveer de helft" is juist**, en na de
meting van par. 0.3 eerder te laag dan te hoog.

### 0.2 Acht naamsbotsingen, en de tweede helft is de leerzaamste

`OS.md` heeft dit huis één keer geleerd wat een gedeelde naam kost: twee
bestanden met allebei een `VERMOGENS` en nul gedeelde leden. De vier
oorspronkelijke productnamen dragen alle vier een bezet woord -- geteld in
`server/kern/`:

| Voorgesteld | Het woord | Wat het hier al is | Bestanden |
|---|---|---|---|
| Rights **Vault** | kluis | de identiteitskluis | **192** |
| Proof **Wallet** | wallet | geld -- `WAARDE.md`, `WALLET_SALDO` | **87** |
| Performance **Passport** | paspoort | het identiteitsbewijs, bron van `leeftijdBron` | **139** |
| Likeness **Firewall** | firewall | `kern/economie/firewall.js` | **26** |

**En toen zijn de vier VERVANGENDE namen ook gemeten, want een correctie die
zelf niet gemeten wordt is een mening.** Drie van de vier zijn óók bezet:

| Vervanger | Stand |
|---|---|
| **Rechtenhuis** / `rechtenregister` | **vrij** -- 0 treffers |
| **Loopbaanbewijs** | **bezet** -- `public/apps/loopbaanbewijs.html` bestaat al ("Een regel uit een loopbaan"), het deelscherm van het Career Ledger |
| **Bewijsmap** | **bezet** -- en wel door precies deze functie; zie par. 0.3 |
| **Herkomst** | **bezet, het zwaarst van allemaal** -- 145 bestanden, met **zeven** eigen `herkomst.js`-modules (command, fiscaal, isolatie, kosten, payroll, rtfos, en de kern zelf), plus de `herkomst` van elk reisonderdeel in `REIZEN.md` |

Dat vier op de acht voorgestelde namen bezet blijken en drie daarvan pas bij de
tweede ronde, is geen slordigheid maar de reden dat deze meting bestaat. **Een
naam die logisch aanvoelt in een nieuw domein voelt daar even logisch aan waar
hij al woont.**

En de bruikbare regel uit het voorstel staat: **een codenaam en een schermnaam
hoeven niet hetzelfde te zijn.** In code `rechtenregister`, op het scherm *Mijn
rechten*. De botsing zit in de code; de leesbaarheid zit op het scherm.

### 0.3 De Bewijsmap bestaat al, en zij is langs dezelfde weg genoemd

Dit is de vondst van deze ronde en zij verdient een eigen paragraaf.

`server/kern/rtgid-bewijs.js` plus `/apps/bewijsmap.html` zijn de voorgestelde
Proof Wallet, en de kop van dat bestand zegt letterlijk:

> *"HDI.md par. 2 stelde een `bewijsmap` voor (het woord `wallet` was bezet: dat
> is geld, en een wallet die soms geld en soms een diploma draagt laat de vraag
> 'mag dit eruit?' twee antwoorden hebben)."*

Dit huis heeft dus **al een keer dezelfde naamsafweging gemaakt, om dezelfde
reden, en is op dezelfde vervanger uitgekomen.** Dat is een sterker argument
voor de discipline van par. 0.2 dan welke redenering ook.

En wat er staat, is precies de vorm die het voorstel vraagt: **wat er de deur
uit gaat is een vinkje en een datum.** Niet welke stukken iemand heeft, niet van
welke instantie, en nooit het nummer. Met drie gronden die geen voorzichtigheid
zijn maar grenzen: een nummer voert de codenaam terug naar een mens, een lijst
stukken is een profiel, en `false` zegt niet waarom.

**Wat er dus niet gebouwd hoeft te worden:** de selectieve deling zelf. Wat
ontbreekt is uitsluitend het **formaat** -- vandaag een eigen vorm, en de vraag
of daar VC 2.0 / OpenID4VCI onder moet (par. 9). Dat is een besluit over
interoperabiliteit, geen functioneel gat.

### 0.4 De gesloten lijst, en waar de pods op sneuvelen

`kern/vertegenwoordiging/bevoegdheden.js` kent **negen** bevoegdheden en
**zeven** dingen in NOOIT. De gevraagde managerhandelingen vallen er één op één
in: aanbiedingen ontvangen (`aanbod.ontvangen`), onderhandelen
(`aanbod.bespreken`, `klaarzetten: true`), een concept opstellen
(`contract.opstellen`), afspraken voorstellen (`agenda.voorbereiden`), reizen
klaarzetten (`reis.voorbereiden`), facturen klaarzetten
(`factuur.voorbereiden`), loopbaan lezen (`loopbaan.lezen`). En de drie verboden
-- tekenen, geld verplaatsen, bankgegevens wijzigen -- staan alle drie in NOOIT.

**Het voorgestelde machtigingsscherm is bijna letterlijk het bestaande.**

Eén gevraagd onderdeel valt er hard buiten, en het is het vanzelfsprekendste:
**een lead manager die werk doorzet naar een specialist is delegatie**, en
delegatie staat in NOOIT met zoveel woorden -- *"een machtiging die zichzelf kan
doorgeven, is geen machtiging maar een sleutel."* Zie par. 3.

### 0.5 Twee voordelen, en maar één ervan is vandaag dicht

**Het bevoegdheidsvoordeel is dicht.** Er is geen kantoorweg naar een
machtiging, en `routes/vertegenwoordiging.js` draait achter de domeingrens
`vertegenwoordiging` en **kan per definitie niet bij `kluisAuth`** -- dat staat
uitgeschreven in de kop van `routes/office/voogdij.js`, de enige kantoorroute in
dit domein, en die gaat over iets anders. Een RTG-manager staat in
`HOEDANIGHEDEN` naast zaakwaarnemer, boekhouder, advocaat, coach, assistent en
ouder, en krijgt zijn bevoegdheden doordat de cliënt ze aanvaardt.

**Het informatievoordeel is niet dicht, en het hoort ook niet dicht te zijn.**
`kern/ledenbalie.js` is de derde poort van het kantoor: een medewerker kan een
lid zoeken en zijn dossier inzien. Die balie is streng ontworpen -- geen naam,
geen e-mailadres, geen document, alleen de codenaam, de pas, land en stad, lid
sinds, de abo-stand en de open klachten -- en **elke blik laat een spoor na** in
het bestaande inzagejournaal (`server/inzagelog.js`), met een reden die iets
zegt.

Een medewerker van RTG die óók de manager van een cliënt is, heeft dus via zijn
dienstverband een kennisweg die de externe manager niet heeft. Niet door een lek,
maar door een legitieme voorziening die moet blijven bestaan. Daaruit volgt de
vorm van MN-02 in par. 4: geen gelijkheid, maar **scheiding van hoedanigheden**.

### 0.6 Het journaal faalt open, en niemand heeft dat gekozen

Dit is de vondst van deze ronde, en zij beantwoordt een vraag die als storing
werd gesteld: *wat gebeurt er als het journaal niet kan schrijven?*

Gemeten in `server/inzagelog.js`:

- `noteer()` geeft de weggeschreven regel terug, of `null`. **Geen enkele van de
  42 bestanden die het journaal aanroepen leest die uitslag.** In
  `kern/ledenbalie.js` staat de aanroep als losse regel en het dossier gaat er
  direct achteraan de deur uit.
- Het wegschrijven zelf is `if (SAVE) { try { SAVE(); } catch (e) {} }` -- een
  mislukte opslag verdwijnt **stil**, precies de faalvorm die `AFSPRAAK.md` al
  een keer heeft opgeleverd met `res.append`.
- Zonder database valt `rij()` terug op een lege lijst, en dan schrijft `noteer()`
  in een array die nergens heen gaat en geeft een regel terug alsof het lukte.

Dus: **vandaag gaat de inzage door, ook als het spoor niet geschreven wordt, en
de aanroeper merkt er niets van.** Dat is geen besluit dat iemand genomen heeft;
het is de stand die ontstaat als je logging naast een handeling zet in plaats van
ervóór.

De belofte *"elke blik laat een spoor na"* is dus vandaag een belofte over de
bedoeling en niet over de uitkomst. Twee dingen erbij, want ze horen in dezelfde
zin:

- **Het journaal is een ringbuffer.** `MAX = 5000`, en loopt hij vol dan valt de
  oudste eraf. De vraag *"wie heeft mijn naam opgezocht?"* heeft dus een horizon.
- **Wat er staat is wél onvervalsbaar.** Er ligt een hashketen onder
  (`lib/keten.js` plus `lib/keten-anker.js`), dus een regel die er staat kan niet
  ongemerkt worden veranderd. Maar een keten bewijst dat wat er staat klopt, niet
  dat er niets ontbreekt.

**En "geen exception" is hier niet hetzelfde als "vastgelegd".** Dat is geen
theoretisch bezwaar maar de gemeten semantiek van `save()` in `server/db/index.js`:

- **Binnen een bundel** (`bijeen()`) zet `save()` alleen een vlag --
  `if (doos && doos.open) { doos.nodig = true; return; }` -- en de echte
  schrijfactie gebeurt aan het eind, buiten die context.
- **In PostgreSQL-modus** werkt een verzoek op een geïsoleerde copy-on-write
  weergave, en markeert `save()` uitsluitend dat de responsepoort vóór het
  antwoord één autoritatieve commit moet doen.

In allebei de gevallen keert `save()` dus succesvol terug terwijl er nog niets
duurzaam staat. Een poort die zich tevredenstelt met "er kwam geen fout uit"
verplaatst het probleem alleen van een genegeerde uitzondering naar een **valse
bevestiging**.

**Het huis heeft de foutinjector die dit bewijst al gebouwd, en hij is nooit op
het journaal gericht.** `server/lib/verraad.js` kent precies deze twee
scenario's, en de kop van `save()` beschrijft de fout van `inzagelog.js`
woordelijk zonder hem aan te wijzen:

> `schrijf-verloren` -- *"deze functie keert NORMAAL terug zonder iets te
> bewaren: de aanroeper krijgt zijn 200 en gelooft dat het vaststaat."*
> `schrijf-faalt` -- *"een aanroeper die dat stil wegvangt, meldt succes over
> niets."*

Gemeten: **acht toetsbestanden** beproeven hun domein onder `schrijf-verloren`
(notities, bank, rem, aidata, persistentiestand, kantoorawait en twee
opslagtoetsen). **Tien toetsbestanden** raken het inzagejournaal. De doorsnede is
**nul**. Het instrument bestaat, het wordt gebruikt, en juist de laag waarvan de
hele belofte "elke blik laat een spoor na" is, staat er niet onder.

### 0.7 Het instrument bestaat, de plek klopte niet, en het kantoor was onmeetbaar

> **Stand 13 september 2026:** alles in deze paragraaf is nog waar behalve de
> laatste helft van de titel. Het inzagejournaal staat inmiddels op de lijst van
> `check.js` regel 47 (via `opzet/inzagespoor.js`), de ledenbalie weigert zonder
> aantoonbaar spoor, en de kantoorkant is beproefbaar. Zie par. 0.6a voor de
> getallen en besluit 5 voor wat er precies gebouwd is. De diagnose hieronder
> blijft staan omdat zij verklaart WAAROM het zo gebouwd is.

Bij het uitwerken van besluit 5 is de code gelezen in plaats van aangenomen, en
dat corrigeerde drie dingen -- waaronder een bewering van dit document zelf.

**Het duurzame primitief bestaat al, en het is bewust schaars.**
`db.saveDuurzaam()` (`server/db/duurzaam.js`) slaat het write-behind plannen over
en schrijft **synchroon met een fsync**, en keert pas terug als de opslag heeft
bevestigd. Zijn eigen kop draagt de waarschuwing die hier anders bedacht had
moeten worden: *"Zodra iemand hem leest als 'de veilige save', staat hij binnen
een half jaar onder een profielwijziging en een like."* `scripts/check.js` regel
47 bewaakt daarom de **aanroeperslijst**, en elke regel daarin noemt zijn reden.
Er hoeft dus geen tweede contract naast `save()` bedacht te worden; het staat er,
met een poort eromheen.

**En deze laag staat er al op.** In die lijst staan
`kern/vertegenwoordiging/index.js` (*"een machtiging is de bevoegdheid van een
mens over het leven van een ander"*), `kern/rugdekking/index.js` (*"een sporter
denkt dat RTG achter hem staat terwijl er niets staat"*),
`kern/carriereledger/index.js` en `carriereledger/deel.js`. De machtiging, het
programma en het loopbaanboek zijn dus **duurzaam**. Het inzagejournaal staat er
niet op -- en dat is precies de laag waarvan de hele belofte een spoor is.

**De plek die par. 0.6 noemde, klopt niet.** Dit document schreef dat de
reparatie in `kern/kantoor/kluispoort.js` hoort. Gelezen blijkt die poort een
**identiteitspoort**: hij draait vóór de route, vraagt via `officeAuth` of deze
sessie een mens draagt (`sess.lidKey`), en roept dan `next()`. Hij weet niet naar
wie er gekeken wordt en met welke reden -- dat ontstaat pas in de handler. Een
journaalcontract daar neerleggen zou de poort iets laten registreren wat hij nog
niet kent. Het contract hoort dus bij **het journaal en de gevoelige leesweg**,
niet bij de deur ervoor. Dat de reparatie op één plek hoort en niet in 42, blijft
staan; alleen de plek was verkeerd gekozen.

**En de klasse-meting die hierbij hoort, bestaat ook al.**
`FAALPROEF.json` (`scripts/faalproef.js`) is precies de vraag *welke belofte
faalt netjes als er iets onder hem wegvalt*: per route, het contract eerst
afgeleid uit een gemeten effectprofiel en pas daarna beproefd met `schrijf-faalt`
en `schrijf-verloren`. 4904 routes.

**Maar over het kantoor zei hij bijna niets, en de reden was dezelfde als bij de
derde ketenproef.** Van de 570 `/api/office/`-routes stond er **528** op
`ongemeten`, 33 op `bewezen` en **9** op `gezakt`. De hele ledenbalie droeg als
reden *"de proef kreeg hem niet aan het werk (status 403)"*: de kluispoort die
zijn werk doet, want de proef kwam binnen met de gedeelde kantoorcode. Exact de
grens die `toelatingsproef.js` ook vond -- *aftekenen en beslissen eisen een
naam*. Het gevolg was scherp: **de gevoeligste helft van dit huis was de minst
beproefde** -- niet omdat iemand dat besloot, maar omdat de poort die identiteit
eist en de proef die er geen heeft elkaar precies uitsluiten.

### 0.6a Wat er daarna van die meting overbleef (13 september 2026)

Die drie getallen zijn geen stand meer maar een beginpunt; ze staan hierboven
omdat ze de RICHTING verklaren en niet omdat ze nog gelden.

**Het instrument kreeg twee kantoormensen.** De sleutelbos van de proeven
(`scripts/lib/proefsleutels.js`) had er een, en dat was de eigenaar -- die komt
door elke kantoordeur en bewijst dus niets over WIE er doorheen kwam. Nu zijn er
`kantoor-a` en `kantoor-b`: twee verse accounts, allebei niet de eigenaar, die
de weg van een medewerker lopen. Daarmee is voor het eerst beproefd wat twee
mensen nodig heeft: A start een uitgifte en tekent → **409, "dezelfde ogen
tellen niet dubbel"**; B tekent → 200. Het vier-ogenprincipe van
`server/routes/uitgifte.js` was tot die dag principieel niet te beproeven, niet
omdat het zwak was maar omdat het instrument geen tweede paar ogen had.

**En de balie bleek verkeerd INGEDEELD, niet onbereikbaar.** `balieAuth` stond
in de bewakerskaart als *verfijner* -- "versmalt binnen een al vastgestelde rol"
-- terwijl hij de rol `office` in zijn GEHEEL weigert. Twee registers spraken
elkaar tegen: `scripts/kantoormacht.js` zette hem al in `EIST_MENS`, en de
goedkoopste van de twee bepaalde wat er beproefd kon worden. Daar kwam een regel
uit die breder geldt dan deze deur: **een verfijner boven een rol die geen mens
vaststelt, is een indelingsfout** -- ofwel hij versmalt op een mens die er niet
is, ofwel hij is een identiteitspoort. `office` is de enige rol op de kaart waar
dat kan, en balieAuth was er de enige van; `test/bewakers.test.js` houdt het nu
tegen.

**De negen `gezakt` waren er al zeven minder, en het register wist het niet.**
De zeven verwijderroutes zijn eerder gerepareerd (`kern/kantoorwissen.js`); het
INGECHECKTE `FAALPROEF.json` stond nog op de ronde van 10 september. *Een
register dat niet is hergedraaid, is een bewering over het verleden* -- en het
zag er precies zo uit als een openstaand gebrek. Dat is dezelfde faalvorm als
het journaal, een laag hoger: niet een fout in de code, maar een uitslag die
niemand opnieuw heeft gemeten.

De twee die echt overbleven zijn gerepareerd, en de leerzaamste is
`/api/bank/akkoord`: die stond **al** op de afdwinglijst van `check.js` regel
47, met de reden *"een geopende rekening en een gegeven akkoord mogen niet
verdwijnen na een herstart"*. Het OPENEN was duurzaam gemaakt en het AKKOORD
niet -- en bij een lid dat al een rekening had, was die ene `save()` de enige
schrijfactie van de hele route. **Een regel op een afdwinglijst noemt een ROUTE
en niet een handeling**, en dat verschil kostte hier precies de helft die
juridisch iets betekent. Huisbreed ging `gezakt` van 3 naar 1; aan de
kantoorkant van 9 naar 1.

**En het getal 528 bleek onleesbaar in plaats van alarmerend.** Vijf
verschillende dingen heetten `ongemeten`: een LEESroute (geen bevestiging om te
breken), een klaarzetter (geen duurzame belofte), *niet bereikt* (een tekort van
het instrument), *onzeker* en het echte onbekende. De eerste twee zijn een
EIGENSCHAP van de route. Alleen *niet bereikt* hoort omlaag, en zolang ze op een
hoop staan is niet te zien of een daling vooruitgang is of een route die stopte
met schrijven. Ze hebben nu elk een eigen stand -- dezelfde vorm als `MET_REDEN`
in `scripts/tikken.js` en `openBekend` in `scripts/ritproef.js`.

Met die splitsing ziet de kantoorkant er zo uit (578 routes, gemeten 13
september 2026):

| Stand | Aantal | Wat het is |
|---|---|---|
| `niet-bereikt` | **316** | een tekort van het INSTRUMENT -- het enige getal dat omlaag hoort |
| `niet-mutatief` | 132 | een EIGENSCHAP: deze route schrijft niet, er is geen bevestiging om te breken |
| `onzeker` | 55 | de twee metingen spraken elkaar tegen |
| `bewezen` | **41** | faalt aantoonbaar netjes onder beide sabotages |
| `voorziening` | 33 | zet bij het eerste bezoek zijn standaard klaar; geen duurzame belofte |
| `gezakt` | **1** | `/api/office/magnaat/scan` |

### 0.6b De laatste gezakte route, en waarom hij dat blijft

`/api/office/magnaat/scan` is de enige die overbleef, en hij is NAGEMETEN in
plaats van weggewerkt -- want het makkelijke antwoord (hem aan de duurzame
commit hangen) zou precies de fout zijn waar `db/duurzaam.js` in zijn eigen kop
voor waarschuwt: *"Zodra iemand hem leest als 'de veilige save', staat hij binnen
een half jaar onder een profielwijziging en een like."* Een meter groen maken
door de schaarste van een primitief op te geven, is het register optimaliseren in
plaats van het systeem.

**Wat de scan werkelijk schrijft, gemeten op een draaiende server.** De zestien
voorstellen die hij teruggeeft staan in de ZAAISET; de scan maakt ze niet. Twee
scans achter elkaar geven allebei `nieuw=0`, en na een herstart staan ze er nog,
vóór er opnieuw is gescand. Het enige dat deze route wegschrijft is
`s.laatsteScan` -- een tijdstempel die de dagelijkse herhaling afremt.

**En het verlies daarvan valt de veilige kant op.** Raakt die tijdstempel weg,
dan slaat de volgende scan de daggrens NIET over en draait hij gewoon. Dat kost
rekenwerk en verliest niets. Ook een scan die wél iets vindt is herstelbaar: de
voorstellen worden ontdubbeld op `kans.sleutel`, dus wat verloren ging komt bij
de volgende ronde terug.

**Daarmee is `gezakt` hier waar én misleidend tegelijk**, en die twee gaan samen.
Het contract van de faalproef is mechanisch -- 200 terwijl de toestand niet
veranderde -- en dat is precies wat er gebeurde. Wat het contract niet kan zien
is of het gevolg HERREKENBAAR is, en bij een cache-tijdstempel is dat het hele
verschil met een verwijderde map of een verdwenen bankakkoord.

**De instrumentfout eronder is groter dan deze route.** `profielVan()` kent
`voorziening` voor een route die bij zijn EERSTE bezoek zijn standaard klaarzet
(eerste oproep schrijft, tweede niet). Deze schrijft bij ELKE oproep, en dus valt
hij in `duurzaam` -- terwijl het geschrevene geen duurzame belofte is. Er is geen
categorie voor *schrijft altijd, maar het is een cache*, en zolang die er niet is
komt elke zulke route als een bevinding binnen.

Dit is een **besluit** en geen bouwtaak, met de vorm die `MUTATIECONTRACT.md` al
heeft gekozen: meting en besluit naast elkaar, waarbij het besluit de meting
nooit wegdrukt (`IDEMBESLUIT.json`). Drie wegen:

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Een besluitregister naast de meting** *(aanbevolen)* | Per route een verklaring `herrekenbaar` met een grond, zoals `IDEMBESLUIT.json` dat voor herhaalbaarheid doet. De meting blijft `gezakt` staan. | Een register erbij, en iemand moet de gronden schrijven. |
| B. Een profielsoort erbij (`cache`) | De klasseerder leert het onderscheid en de route valt niet meer in `duurzaam`. | Het oordeel verhuist naar de METER, en die kan niet weten of een schrijfactie herrekenbaar is -- dat is domeinkennis. |
| C. De route duurzaam maken | Eén getal groen. | De schaarste van `saveDuurzaam()` opgeven voor een tijdstempel in de simulatiewereld. |

Zolang er niets is gekozen blijft de route `gezakt` staan, met deze paragraaf
ernaast. Dat is de eerlijke stand: één gemeten bevinding, één uitgeschreven reden
waarom hij niet is gerepareerd, en geen stille uitzondering.

---

Van de oude 528 is dus **165 een eigenschap en geen gebrek**, en het echte
tekort is 316. Dat laatste getal is bovendien geen raadsel meer maar een
werklijst met een vorm: 219 van die 316 stranden op een **404** en 82 op een
**400**. De balie zit in die tweede groep -- zij komen sinds deze ronde dóór de
poort (403 → 400) en stranden nu op het LICHAAM: deze routes eisen een `reden`
met inhoud en een bestaand lid-id, en `plausibelLijf()` kent geen van beide.

**Dat is bewust niet in deze ronde gerepareerd, en de reden is dezelfde als de
rest van dit document.** Een veld toevoegen aan `plausibelLijf()` klinkt als één
regel, maar die functie voedt VIJF proeven -- waaronder de invoerproef, die met
opzet slechte invoer stuurt. Een verandering daar verschuift de uitslag van vier
andere meters, en een reparatie waarvan je de blast radius niet hebt gemeten is
precies wat `MUTATIECONTRACT.md` een schijnzekerheid noemt. Het staat hier met
het getal erbij zodat de volgende ronde eraan kan beginnen met een noemer.


---

## 1. De drie vragen waar deze laag over gaat

De hele grondwet valt in drieën uiteen, en een mensgericht platform ontspoort
precies op de plek waar iemand ze door elkaar haalt.

| | De vraag | Waar zij woont |
|---|---|---|
| **Macht** | wie mag iets **doen** namens deze mens | `kern/vertegenwoordiging/`, de NOOIT-lijst, de simulator |
| **Kennis** | wie mag iets **weten** over deze mens | de identiteitskluis, `ledenbalie.js`, het inzagejournaal |
| **Belang** | wie **verdient** aan welke keuze van deze mens | par. 4, en vandaag nergens |

Macht is het best geregeld, kennis is geregeld maar niet tegen dit geval
ontworpen, en belang bestaat nog niet -- want RTG heeft er vandaag geen.

Dat is ook de volgorde waarin ze urgent worden: **belang ontstaat op de dag dat
RTG zelf gaat managen**, en dat is precies de dag waarop de eerste twee niet meer
op goed vertrouwen mogen rusten.

### 1.1 De hoedanigheid is groter dan deze laag, en bestaat in vier bestanden

Eén mens kan binnen RTG tegelijk lid zijn, werknemer, ondernemer, ouder,
manager, cliënt, vrijwilliger van de Foundation en medewerker van RTG. Het
platform weet dus wel *wie* er handelt, maar niet *in welke hoedanigheid*.

Gemeten: het woord `hoedanigheid` komt in `server/` voor in **vier bestanden, en
alle vier in `kern/vertegenwoordiging/`.** Het begrip bestaat dus, maar
uitsluitend als eigenschap van een vertegenwoordiger -- niet als eigenschap van
de handelende mens. En `CARRIERE.md` par. 2 had dat gat al aan de andere kant
gemeten: `kern/envelop.js` draagt wél *wie* (`actor`), *waardoor*
(`correlatie`, `oorzaak`) en *hoe gevoelig* (`classificatie`), maar **niet in
welke hoedanigheid** -- en die toevoeging is een versiesprong op een envelop die
gesloten is op acht velden.

Wat er vandaag feitelijk voor doorgaat zijn de auth-deuren: een sessie komt
binnen als lid, als zaak of als personeel, en dat bepaalt wat zij mag. Dat werkt
voor toegang en het is geen hoedanigheidsmodel: het zegt langs welke deur iemand
kwam, niet in welke rol hij nu staat tegenover déze mens.

**Deze laag is daarmee de eerste plek waar de regel hard bewezen kan worden, maar
de eigenschap is veel groter dan vertegenwoordiging.** Dat is een reden om hem
hier zorgvuldig te bouwen en geen reden om hem hier te verzinnen: wat hier wordt
vastgelegd, wordt later platformbreed geciteerd.

---

## 2. Waar het voorstel tegen een bestaande grens loopt

### 2.1 Geen rangorde op een mens -- en de meting verhuist een niveau omhoog

Een talentladder (`ontdekt → opkomend → ... → nalatenschap`), een
bijdragegrafiek met acht balken per persoon en een netwerkwaarde in euro's per
persoon zijn alle drie hetzelfde ding: een cijfer op een mens. De grens staat
vier keer onafhankelijk (`KANTOORMACHT.md`, `HDI.md`, `ONTMOETEN.md` en
`LIFE.md`), sinds deze zomer met een echte handhaver in
`scripts/lib/cijferopmens.js`, en `HDI.md` sluit de ontsnapping expliciet uit:
**ook niet intern als sorteersleutel.**

**Maar meten hoeft niet te vervallen -- het verhuist een niveau omhoog.** RTG
meet wat een PROGRAMMA oplevert, nooit wat een mens waard is. Een regeling mag
geëvalueerd worden; een mens niet. Dus dit mag:

> *Programma Opkomend Talent 2027: 84 deelnemers, 31 nieuwe zakelijke relaties,
> 92% van de machtigingen correct beëindigd, € X aan commerce.*

En dit niet:

> *Deze mens ontsluit naar schatting 18.400 leden en kost € 8.000 om binnen te
> halen.*

De bestaande vorm voor het eerste is `kern/rtfos/gemeente.js` -- een outcomes
ledger die telt zonder te lezen. Er hoeft dus niets voor bedacht te worden.

**En "wat blijft er over na een carrière" is geen functie maar een afwezigheid.**
Het Career Ledger kent alleen bijschrijven en intrekken; een loopbaanboek
verloopt nergens. Daar hoeft niets voor gebouwd te worden, en er hoort niets voor
gebouwd te worden -- een expliciete `nalatenschap`-stand zou de trede zijn die
par. 2.1 net heeft afgewezen.

### 2.2 De fanladder blijft een trechter

Wat iemand heeft gedaan is een feit; waar hij "staat" is een oordeel. Een artiest
mag zien dat 827 mensen een kaartje kochten en dat 41 er drie keer waren. Hij mag
niet zien dat iemand "trede 4 van 7" is, en de software mag niemand naar trede 5
duwen (`LIFE.md` par. 4, en de `CLAUDE.md`-regel tegen verslavende
engagement-patronen).

### 2.3 De naamsbotsingen -- hernoemen vóór de eerste regel code

Zie par. 0.2. Van de acht gemeten namen is er één vrij: **`rechtenregister`** in
code, *Mijn rechten* op het scherm. De rest wijkt uit of bestaat al.

### 2.4 Er is één beginscherm, en het is niet van de mens alleen

`WERELD.md` is hard: er is **één** beginscherm. Daarnaast kent `WERELDEN.md`
vier werelden, en `PLATFORM.md` par. 0b verbiedt een vijfde -- een toptalent
staat in LivingOS, WorkOS, TravelOS en FoundationOS tegelijk. Wat het voorstel
beschrijft is geen wereld maar een **werkblad** (`WERKRUIMTE.md`), en dat is een
bestaand begrip.

### 2.5 De uitbetaalvraag is geen datamodel

Hier is het voorstel zelf tot de scherpste formulering gekomen, en die vervangt
wat hier eerst stond. **Er komt geen vijfde economische wereld en geen
"economisch persoon".** De natuurlijke persoon bestaat al economisch: de wereld
`consument` in `kern/economie/werelden.js`, en de meting loopt al op vijf
identiteitssoorten (lid, zaak, gezin, lab, huis).

Wat ontbreekt is geen model maar een antwoord op vier losse vragen, en ze hebben
elk een eigen huis:

    MENS
     ├── kan ontvangen?            → beleid, vergunning, rail
     ├── kan vertegenwoordigen?    → machtiging (kern/vertegenwoordiging/)
     ├── kan verkopen?             → commercieel beleid (genre, contract)
     └── kan uitbetaald worden?    → compliance + rail  ← dit is CAR-01

Alleen de vierde is dicht. De bevoegdheid bestaat (`RUGDEKKING_BEURS` in
`kern/bevoegdheid/lijst-afhankelijk.js`, `zonderStand: 'gesloten'`), en de vraag
eronder is juridisch: *onder welke voorwaarden mag RTG geld aan een natuurlijke
persoon uitbetalen?*

**CAR-01 blijft dus dicht tot dat besluit genomen kán worden, en er wordt geen
architectuur omheen gebouwd.** Dat is dezelfde regel als bij de terugstortstand:
de schakelaar ís de juridische positie.

### 2.6 De juridische zekerheidsindeling ontbreekt

Een managementcontract lezen en melden dat er exclusiviteit op alle commerciële
inkomsten rust, is een juridische uitspraak over het contract van een mens. Aan
de fiscale kant bestaat daar een vorm voor: `kern/fiscaal/zekerheid.js`, vier
klassen, met de regel dat een niet-ingedeelde uitkomst terugvalt op de
voorzichtige klasse en dat ook zegt. Aan de juridische kant bestaat die vorm
niet -- er zijn losse zinnen *"geen juridisch advies"* in tien bestanden.

Dus: *"deze overeenkomst loopt automatisch twee jaar door tenzij u 90 dagen van
tevoren opzegt"* is `bepaald` (het staat er letterlijk). *"Deze
commissieregeling is ongebruikelijk breed"* is `advies`. En *"zeg dit contract
voor u op"* is `voorbehouden`.

---

## 3. De mandaatconstellatie

De pods zijn vervangen door iets strengers, en het resultaat is beter dan het
origineel: een team zonder de beveiligingsfout van delegatie.

Een RTG-managementteam is geen bevoegdhedenboom maar een **constellatie van
losse machtigingen**, en de cliënt kan ze vóór aanvaarding per stuk uitzetten:

| | Persoon | Rol | Gevraagde bevoegdheid |
|---|---|---|---|
| ☑ | de lead | lead manager | loopbaan lezen, aanbod bespreken |
| ☑ | commercieel | commercial | aanbod ontvangen, contract opstellen |
| ☐ | reizen | travel | reis voorbereiden |
| ☑ | rechten | rights | contract lezen |
| ☐ | financieel | finance | factuur voorbereiden |

Eén scherm, één beweging, en daarachter **vijf afzonderlijke machtigingen**. De
bestaande simulator toont per onderdeel wat het betekent en wat er níét opengaat.

**De regel die eruit volgt, en die nergens anders moet worden herhaald:** de lead
manager kan een specialist niet toevoegen, alleen **voorstellen**. De cliënt
krijgt het voorstel, ziet de simulatie en aanvaardt zelf. Zelfs degene die de
hoofdrelatie met de cliënt heeft, kan dus geen organisatie achter zich toegang
geven.

De enige nieuwe steen is een **machtigingsbundel**: één voorstel dat meerdere
machtigingen tegelijk klaarzet, met een aanvaarding per stuk. Dat is een scherm
en een route, geen nieuw rechtenmodel -- de doorsnede, `leeg is dicht` en het
berekende verval blijven exact zoals ze zijn.

---

## 4. De grondwet

Drie constitutionele regels en vier die eronder hangen. De drie zijn genummerd
naar hun gewicht; de vier die er in een eerdere versie bovenaan stonden zijn
doorgeschoven, want een vergoedingsafspraak is geen grondrecht.

### MN-01 -- geen bevoegdheidsvoordeel

> **Geen organisatorische relatie met RTG kan menselijke toestemming vervangen,
> verruimen, doorgeven of reconstrueren.**

Te bewijzen, en niet te documenteren. Tien gevallen, en de laatste is de
overtuigendste:

1. RTG-medewerker zonder machtiging → nul toegang.
2. Externe manager met machtiging → toegang volgens de scope.
3. RTG-manager met exact dezelfde machtiging → exact dezelfde toegang.
4. RTG-beheerder → geen omweg.
5. Lead manager → kan een specialist geen bevoegdheid gevén.
6. Specialist → eigen machtiging vereist.
7. Machtiging ingetrokken → beiden verliezen onmiddellijk toegang.
8. Dienstverband gewijzigd → geen automatische cliëntrechten.
9. Interne rol verhoogd → geen verruiming van cliëntrechten.
10. Een functieschakelaar kan NOOIT niet openen.

En de aanvalsproef: **maak de eigenaar van RTG zelf manager van een testtalent
en bewijs dat hij zonder machtiging niets kan.** Dat is overtuigender dan tien
alinea's.

### 4a. MN-01 als toets (13 september 2026)

`test/mn01-bevoegdheidsvoordeel.test.js`. Tot deze toets bestond werd MN-01
afgedwongen door een **afwezigheid**: er was geen kantoorweg naar een
machtiging, en `routes/vertegenwoordiging.js` draait achter de domeingrens
`vertegenwoordiging` en kan per definitie niet bij `kluisAuth`. Dat is waar, en
het is geen handhaver -- wie er morgen een route bij zet, breekt de regel zonder
dat er iets rood wordt, en de eerste die het merkt is een cliënt.

**Twee helften, en ze bewijzen verschillende dingen.**

*Structureel* (snel, geen server): geen kantoorroute raakt de machtigingslaag, op
één verklaarde uitzondering na. Die uitzondering is `POST /api/office/voogdij/besluit`
achter `kluisAuth`, en de reden staat erbij: een voogdijbesluit gaat over een
minderjarige, en dáár kan de cliënt zelf geen toestemming geven. Het is dus geen
omweg om toestemming heen maar de plek waar toestemming nog niet kan bestaan. De
toets eist ook de DEUR: verhuist die uitzondering ooit naar de gedeelde
backofficecode, dan is zij iets anders geworden.

*De aanvalsproef*: de **eigenaar** van RTG -- de sterkste rol die dit huis kent,
want hij komt door `officeAuth` zonder code, door `boardroomAuth` en door
`kluisAuth` -- krijgt nul toegang tot het leven van een cliënt. Kan hij niets,
dan kan niemand met een organisatorische relatie iets.

**De scherpste toets kwam er pas na drie pogingen, en elke keer vond een mutatie
dat hij niets mat.** Dat hoort hier te staan, want het is leerzamer dan de
uitkomst:

1. Eerste versie: handelen op een *verzonnen* id, dat afketste. Dat bewijst
   alleen dat een ONBEKEND id wordt geweigerd. Erger: het id ging mee in het
   veld `mid` terwijl de route `id` leest, dus de route kreeg een lege string en
   had ook zonder enige controle geweigerd.
2. Tweede versie: `/mijn` met een leeg lichaam opvragen en vaststellen dat het
   team van de eigenaar de codenaam van het slachtoffer niet bevat. Dat team is
   leeg, dus dat was altijd waar. Met `mijn((req.body||{}).key || req.session.key)`
   in de route bleef de toets groen: het gat stond open en niemand merkte het.
3. Derde versie: het slachtoffer krijgt eerst een eigen grens, zodat er iets te
   lekken válT, en de aanval duwt op vijf plausibele veldnamen in plaats van op
   één.

Wat de proef nu doet is **één machtiging, echt aanvaard door de cliënt, met twee
aanroepen erop**: de gemachtigde agent krijgt 200, de eigenaar van RTG krijgt op
HETZELFDE id 404. Het id is dus aantoonbaar geldig, en het enige verschil is wie
het vraagt. Dat is MN-01 in twee regels.

**Die opstelling kon pas sinds par. 0.6a.** De cliënt moet door `volwassen()` --
18 jaar én A3, dus RTG heeft het identiteitsbewijs gezien -- en die weg loopt via
het kantoor (`/api/office/verify`, achter `kluisAuth`). Zonder een kantoorsessie
op naam is deze proef niet te bouwen. De sleutelbos uit stap 1 van de
betrouwbaarheidsronde was dus niet alleen voor de faalproef nodig.

**Vijf mutaties, elk door zijn eigen toets gepakt**: een tweede kantoorroute naar
de laag, de uitzondering verhuisd naar de gedeelde code, `/mijn` dat zijn sleutel
uit het lichaam leest, de 18+-poort eruit, de eigenaarscontrole bij handelen
eruit, en een intrekking die niets vastlegt.

**Eén detail dat geen toets is maar wel een regel.** De structurele helft leest
**code en geen proza**. `routes/office/werk.js` NOEMT deze laag in een kop die
uitlegt waarom hij er juist niet bij kan -- op de rauwe bron stond dat bestand op
de overtrederslijst omdat het de regel goed had begrepen. Dezelfde les als
`npm run check` regel 47.

**Wat deze toets NIET dekt:** MN-02. Dat een medewerker via de ledenbalie méér
weet is legitiem (par. 0.5), en de regel daarover gaat over
niet-overdraagbaarheid en niet over gelijkheid. Die staat apart, als regel 2b.

### MN-02 -- scheiding van hoedanigheden

> **Geen bevoegdheid of kennis die in hoedanigheid A is verkregen, mag
> stilzwijgend worden gebruikt in hoedanigheid B.**

Dit is niet *"een RTG-manager ziet altijd precies hetzelfde als een externe"* --
die formulering sneuvelt op par. 0.5, want een medewerker mág via de ledenbalie
meer weten, op grond van een andere en legitieme hoedanigheid. De regel gaat dus
niet over gelijkheid maar over **niet-overdraagbaarheid**.

Drie contexten voor één mens, en ze lopen niet in elkaar over:

    als manager     → wat de cliënt hem heeft gemachtigd te zien
    als medewerker  → een legitieme opvraging, met reden, journaal en melding
    als eigenaar    → geen vierde deur

Zeven proeven, en de laatste drie zijn de moeilijke:

1. Managercontext → ledenbaliegegevens zijn er niet.
2. Kantoorcontext met een geldige reden → minimale gegevens beschikbaar.
3. Opvraging → regel in het inzagejournaal.
4. Opvraging → melding aan de cliënt volgens bestaand beleid.
5. Terug naar de managercontext → wat zojuist in de kantoorcontext is gezien,
   reist niet mee.
6. AI-context van de manager → kantoorgegevens zijn er ook niet als *verborgen*
   context.
7. Export, rapport en cache → geen kruisbesmetting.

Nummer 6 en 7 zijn de reden dat deze regel bestaat: **je kunt perfect
afgeschermde routes hebben terwijl een contextbouwer twee werelden alsnog
samenvoegt.** Wat hier gebouwd wordt is geen toegangsregel maar
niet-interferentie tussen hoedanigheden, en dat is een andere en zwaardere
eigenschap.

Wat er al staat om op te bouwen: het journaal, de verplichte reden, en de
melding aan het lid (`kern/consent-register.js`: *"U krijgt van elke opvraging
bericht, en ze staat met reden in het inzagejournaal."*). Wat ontbreekt is dat
een medewerker die een machtiging houdt voor een cliënt, voor díé cliënt een
belanghebbende is -- en dat dat aan de kant van het lid zichtbaar wordt.

**De vorm waarin dit uiteindelijk afdwingbaar wordt, is een familie van vijf
velden rond de handelende mens** -- en drie ervan staan al in `kern/envelop.js`:

| Veld | Vraag | Stand |
|---|---|---|
| `actor` | wie handelt | **staat** (een codenaam) |
| `hoedanigheid` | in welke rol | **bestaat niet** buiten `kern/vertegenwoordiging/` |
| `principal` | voor wie, namens wie | **bestaat niet** |
| `oorzaak` | waardoor gebeurt dit | **staat** |
| `correlatie` | bij welk proces hoort dit | **staat** |

Met die vijf zijn regels af te dwingen die met routepermissies niet te schrijven
zijn -- *een kantoorcontext mag dit dossier lezen, en die kennis stroomt niet door
naar een managementcontext of een AI-context.* Maar let op de prijs die
`CARRIERE.md` par. 2 al noemde: de envelop is met opzet **gesloten op acht
velden**, dus twee velden erbij is een **versiesprong** en geen toevoeging. Wie
ze in de inhoud propt, heeft de grens omzeild zonder hem te veranderen.

**En de UX-regel die erbij hoort, want hij is een beveiligingsgrens en geen
sierfunctie.** Een mens kiest niet voortdurend een technische rol, maar op een
risicovol kruispunt is de context onmiskenbaar: *Management · namens Mila* of
*RTG Kantoor · ledenservice*. Probeert iemand vanuit de ene context iets waarvoor
alleen de andere bevoegd is, dan **wisselt het systeem nooit vanzelf**:

> *"Dit kan niet vanuit het management van Mila. Deze handeling hoort bij je
> RTG-kantoorrol."*

Automatisch wisselen zou van de grens een formaliteit maken, en precies dat is
wat `GRAMMATICA.md` bedoelt met een verhindering die altijd een reden draagt.

### 4b. MN-02 als toets (13 september 2026)

`test/mn02-hoedanigheidsscheiding.test.js`. Dit is een **ander soort proef** dan
4a, en ze mogen niet op een hoop: MN-01 gaat over BEVOEGDHEID en is structureel
te meten -- er is een deur, en die gaat niet open. MN-02 gaat over KENNIS, en
daar is de verkeerde formulering verleidelijk:

> FOUT: *"een RTG-medewerker mag niet meer weten dan een externe manager"*
> GOED: *"wat hij in hoedanigheid A weet, is in hoedanigheid B niet beschikbaar
> zonder eigen grond"*

De eerste is aantoonbaar onwaar én soms gewenst -- `kern/ledenbalie.js` is een
legitieme kennisweg met een reden, een journaalregel en bericht aan de
betrokkene (par. 0.5). Een toets die die weg dichtzet, meet niet MN-02 maar
breekt de balie.

**Daarom twee helften die de andere kant op trekken**, en alleen samen bewijzen
ze iets:

1. legitieme extra kennis **blijft mogelijk** -- de kantoorweg geeft 200;
2. en die kennis **draagt niet over** -- de managerweg blijft schoon.

Zonder (1) is de goedkoopste implementatie *"blokkeer alle kantoorinzage voor
managers"*, en dan staat de toets groen terwijl het product stuk is. Dat is geen
theoretisch bezwaar: het is de vierde mutatie hieronder, en zonder toets 2 zou
die er ongezien doorheen komen.

**Eén mens, twee sessies.** R is tegelijk benoemd kantoormedewerker mét een
baliezetel én manager van Mila via een aanvaarde machtiging -- met opzet op
hetzelfde account. Bij twee verschillende mensen meet je toegangsscheiding en
niet hoedanigheidsscheiding. (Daarom niet via `kantoorAlsPersoon()` uit
`test/helper.js`: die registreert een vers account, en dan zijn het twee mensen.)

**De volgorde is het bewijs.** De managercontext wordt VÓÓR en NA de
kantoorinzage opgehaald en moet byte voor byte gelijk zijn. Drie asserties, elk
tegen een andere overdrachtsweg: geen veldnaam uit de kantoorweg, geen WAARDE
ervan (een veld is te hernoemen), en niets veranderd (de gedeelde cache).

**Vier mutaties, elk door de juiste toets gepakt:**

| Mutatie | Gepakt door |
|---|---|
| een kantoorVELDNAAM in de contextbouwer | toets 3 (a) |
| dezelfde WAARDE onder een onschuldige naam | toets 3 (b) |
| de managercontext niet-deterministisch | toets 3 (c) |
| **de luie MN-02: kantoorinzage voor iedereen dicht** | **toets 2** |

**En assertie (c) draagt uitgeschreven wat zij wél en niet bewijst.** Zij is
aantoonbaar levend -- de derde mutatie laat alleen háár zakken -- maar dat toont
dat zij een VERSCHIL tussen twee oproepen ziet, niet dat zij een echte
cache-verrijking door de kantoorinzage ziet. Zo'n gedeelde cache bestaat vandaag
niet. Deze regel is dus een **vooruitgeschoven post en geen bewezen eigenschap**;
wie er ooit een gedeelde projectie tussen deze twee wegen bij bouwt, hoort hier
langs te komen.

**Wat in die ronde nog niet was beproefd** was de AI-contextbouwer.
`/api/rahul/kijk` bleek beeldherkenning en geen contextbouwer, en waar de AI zijn
ledencontext samenstelt was toen niet gemeten. Par. 4c hieronder is dat gat.

### 4c. MN-02-AI: de contextbouwer, gemeten en beproefd (13 september 2026)

`scripts/aicontext.js` (`npm run aicontext`, `AICONTEXT.json`) beantwoordt eerst
de vraag VOOR de proef: wat komt er in die context samen? De samensteller is
`aiSystemPrompt(tier, lang, key)` in `server/kern/ai/prompt.js`, en hij heeft
**twaalf invoeren -- 3 op het LID, 2 op de PAS, 4 op het HUIS en 3 vaste tekst.**
Alleen de drie lid-gesleutelde kunnen kennis over één mens dragen, en alle drie
lopen ze langs de sleutel van dát lid.

**De uitslag die het ontwerp stuurt staat in de derde regel van dat register: de
muur is een VELDSELECTIE en geen grens.** De ledenstaat draagt **25 velden**
(lexicaal geteld, dus een ONDERgrens), waarvan er **9 door een kantoorroute
worden geschreven** -- `bewaarVerzoek` voorop, en die draagt de ECHTE NAAM van de
medewerker uit de identiteitskluis. De samensteller leest er **twee** van: `trip`
en `invoices`. De doorsnede van "kantoor schrijft het" en "het model krijgt het"
is vandaag **leeg**, en dat is geen architectuur maar één regel code: de andere
drieëntwintig velden liggen in hetzelfde object, één `...md` verwijderd van een
tekst die woordelijk naar een modelaanbieder gaat.

**Het antwoord op de vraag of de contextarchitectuur moet veranderen is dus
nee -- en de veldselectie moet een handhaver krijgen.** Die is er nu, en dat is
`test/mn02ai-contextbesmetting.test.js`.

**De waarneming is de prompt zelf, en dat is het hele punt.** De samengestelde
context staat op geen enkel scherm en komt in geen enkel antwoord terug; de enige
plek waar hij te zien is, is waar hij het huis verlaat. De proef zet daarom een
nep-modelserver op `127.0.0.1` met `LOCAL_AI_URL` ernaartoe en vangt de system
prompt op zoals het model hem krijgt -- geen fixture van wat de code zou doen,
maar wat er werkelijk uitgaat. Dat is hetzelfde onderscheid dat
`test/vertegenwoordiging.e2e.test.js` afdwong toen de unittoetsen groen stonden
op een verzonnen vorm.

Het experiment: R is één mens met twee hoedanigheden (lid én kantoor, op één
account, met een baliezetel op naam). Tussen twee momentopnamen van zijn
ledencontext gebeuren **twee** kantoorhandelingen, want de vraag heeft twee
richtingen: R LEEST als kantoor het dossier van een ander lid S, en er wordt van
kantoorzijde iets OP het account van R geschreven (een bewaarverzoek).

**Zeven bewijzen, en de dragende is de gelijkheid.** Een lek dat de waarde van S
letterlijk meeneemt is de makkelijke vorm; de gevaarlijke is een AFGELEIDE ("dit
lid woont in dezelfde regio als het laatst geopende dossier"). Daar komt geen
enkele waarde in voor en een zoek-op-waarde ziet hem niet. Verandert de context
na een kantoorhandeling ook maar één teken, dan is er iets overgestoken.

| Mutatie | Gepakt door |
|---|---|
| een kantoorveld MET naam in de prompt | toets 2b en 3 |
| dezelfde waarde onder een neutrale naam | toets 2b en 3 |
| **een AFGELEIDE regel, zonder enige waarde erin** | **alleen toets 3** |
| een contextcache op `key`, zonder hoedanigheid | alleen toets 6 |
| de identiteitsreparatie terugdraaien | alleen toets 1 |

**De vierde regel van die tabel is de leerzaamste van deze ronde.** In zijn eerste
vorm had de proef geen toets 6, en toen sloeg de cache-mutatie **nergens** aan:
wie de prompt bewaart op `key` krijgt twee identieke momentopnamen ongeacht wat
ertussen gebeurde, en dan staat de hele proef groen terwijl hij niets meer meet.
De gelijkheidstoets heeft een blinde vlek die er precies uitziet als succes. Toets
6 sluit hem met een BESTURINGSPROEF: verander iets dat de context wél hoort te
raken (R zet zijn eigen omgangsvorm om) en eis dat de context meebeweegt. *Een
instrument dat niet kan uitslaan, is geen instrument* -- dezelfde gedachte als
toets 5, die van de normalisatie eist dat zij aantoonbaar iets normaliseert.

**En er zijn twee TEGENproeven, want zonder die haalt de luie oplossing het.**
Geef Rahul geen ledencontext en er lekt niets; draai de balie dicht en er lekt
ook niets. Toets 1 eist daarom dat de context wél over dít lid gaat, en toets 4
dat de rechtmatige inzage gewoon 200 blijft geven met het dossier erin.

**Wat de meting onderweg vond, en het was geen contaminatie.** Toets 1 zakte
meteen, en niet op een lek: de regel die het lid NOEMT las `PERSONAS[tier]`, en
dat is de DEMO-rij per pas. Elk echt RTG-Pass-lid werd aan het model voorgesteld
als *"Het lid: Amberen Vos, lid sinds Maart 2026"*, ongeacht wie hij was --
terwijl zijn eigen codenaam `Nachtorchidee E01A` luidde. Precies dezelfde fout als
de demo-reis en de demo-facturen twee regels hoger in hetzelfde bestand, met
dezelfde oorzaak, en daar wél gerepareerd. Hij bleef staan omdat hij onzichtbaar
is: de context staat op geen enkel scherm. De meting vond hem omdat zij `PERSONAS`
op de PAS sleutelde en `ledenInhoudVan` op het LID, en toen opviel dat juist de
identiteitsregel de eerste gebruikte. **De reparatie neemt twee velden op naam
over en nooit een spread**: `publicUser()` draagt ook `full`, en dat is de echte
naam uit de kluis.

**Twee valse bevindingen uit deze ronde, allebei van dezelfde soort, en geen van
beide weggepoetst.** De veldinventaris telde eerst 91 velden in plaats van 25,
omdat de ledenstaat in dit huis ook `st` heet en dat woord huisbreed ook status,
stand en state betekent -- een naam is alleen een ledenstaat in het bestand waar
hij eraan gebonden is. En toets 2b wees een lek aan dat er niet was, omdat
`bewaarVerzoek.door` de echte naam van de eigenaar draagt en die naam woordelijk
in Rahuls karakterportret staat. **Een marker die ook in de vaste tekst voorkomt,
is geen marker.** Beide zijn dezelfde klasse als de `isServerToets`-vondst: een
nette uitslag uit een experiment dat iets anders mat. Zie `BEWIJSMACHINE.md`
par. 6a.

**Wat hier NIET wordt beweerd:** dit gaat over de LEDENcontext. De werkcontexten
(zaak, personeel, kantoor) hebben hun eigen samenstellers en zijn niet gemeten.
En de cache-vorm uit de tabel bestaat vandaag niet -- toets 6 is daarvoor een
vooruitgeschoven post, net als assertie (c) in par. 4b.

### 4d. De AI-contextgrondwet (AI-CONTEXT-01 t/m 06)

Par. 4c beproefde EEN contextbouwer op EEN vraag. Wat daaruit volgt is breder dan
Rahul en breder dan MN-02, want het gaat over elke plek waar dit huis gegevens
klaarlegt voor een model. Zes regels, met per regel wie hem vandaag handhaaft --
en waar dat niemand is, staat dat er.

| | Regel | Handhaver |
|---|---|---|
| **AI-CONTEXT-01** | Een AI-context wordt opgebouwd uit een POSITIEVE lijst velden, nooit uit een object waar daarna gevoelige velden uit worden gehaald | `test/aicontext-allowlist.test.js` (4 bewijzen, 4 mutaties) |
| **AI-CONTEXT-02** | Bestaat er een contextcache, dan zit de HOEDANIGHEID in de sleutel | vandaag **niemand**: er is geen cache. `mn02ai` toets 6 valt zodra er een komt zonder |
| **AI-CONTEXT-03** | Een echte identiteit valt nooit terug op een demo- of persona-rij | `mn02ai` toets 1 |
| **AI-CONTEXT-04** | De prompt wordt beproefd als UITGAANDE gegevensstroom, niet als functie-uitkomst | `mn02ai` (nep-modelserver op `LOCAL_AI_URL`) |
| **AI-CONTEXT-05** | AFGELEIDE kennis telt net zo hard als een gekopieerd veld | `mn02ai` toets 3 (de gelijkheid), bewezen met de afgeleide mutatie |
| **AI-CONTEXT-06** | Elke scheidingsproef draagt een tegenproef EN een besturingsproef | `mn02ai` toetsen 1, 4 en 6 |

**AI-CONTEXT-01 is de dragende, en hij gaat over RICHTING en niet over stijl.**
Twee manieren om hetzelfde resultaat te krijgen:

```js
const context = { ...md };  delete context.bewaarVerzoek;   // NEE
const context = { trip: md.trip, invoices: md.invoices };   // JA
```

Bij de eerste passeert elk NIEUW veld de grens vanzelf en moet iemand eraan
denken het te verwijderen; bij de tweede blijft elk nieuw veld buiten tot iemand
het er bewust bij zet. Dat is het verschil tussen een grens die werkt als niemand
oplet en een die alleen werkt als iedereen oplet. De handhaver eist daarom drie
dingen tegelijk: de gelezen velden zijn gelijk aan een VERKLAARDE lijst
(`LEDENVELDEN` in de samensteller), de ledenstaat wordt nergens in zijn geheel
gekopieerd (geen spread, geen `Object.assign({}, md)`, geen `Object.keys(md)`),
en er wordt nergens iets uit een context VERWIJDERD.

**Waarom de lijst een verklaring is en geen serialisatie.** Er wordt met opzet
niet overheen gelopen om het object te bouwen -- dan was de lijst zelf de
generieke serializer waar de regel voor waarschuwt. De code leest elk veld op
naam; de constante zegt welke dat horen te zijn; de toets houdt die twee gelijk.
Wie er een veld bij zet, verandert ook die regel, en dat is precies de plek waar
een mens ernaar kijkt.

**AI-CONTEXT-02 heeft vandaag geen handhaver en dat is eerlijker dan een regel
met een schijnbewaker.** Er is geen contextcache, dus er valt niets te bewaken.
Wat er wel is, is een MEETINSTRUMENT dat omvalt zodra iemand er een bouwt zonder
de hoedanigheid in de sleutel: dat is de besturingsproef van par. 4c, en hij
bestaat omdat de cache-mutatie zonder hem volledig groen bleef.

**AI-CONTEXT-03 is geen cosmetica.** De demo-persona lekt geen echte mens, dus
op een privacylijst komt hij niet voor. Maar een model dat over de verkeerde
identiteit redeneert, kan daarna alles fout hebben terwijl elke route en elke
bevoegdheid perfect werken -- en het scherm blijft groen, want de prompt staat
nergens. Dat is de reden dat AI-CONTEXT-04 ernaast staat: een assembler die je
als functie toetst, geeft je de waarde die je verwachtte; een prompt die je bij
de uitgang opvangt, geeft je wat er werkelijk gaat.

**AI-CONTEXT-05 is de regel die het duurst is om te vergeten.** Van de vijf
mutaties in par. 4c droeg er een geen enkele waarde en geen enkele veldnaam --
alleen het BESTAAN van een kantoorfeit, in eigen woorden. Een zoek-op-waarde ziet
die niet, een veldnaamlijst ziet die niet, en een mens die de diff leest denkt dat
er niets gevoeligs in staat. Alleen de gelijkheid ziet hem.

### MN-03 -- geen commercieel voordeel

> **Een commercieel belang van RTG verandert het onafhankelijke keuzepad van een
> mens niet, tenzij dat belang expliciet zichtbaar is.**

Zodra RTG zelf management verkoopt, is elke aanbeveling verdacht. De AI mag RTG
niet bovenaan zetten, externe managers niet slechter presenteren, informatie niet
achterhouden en selectiecriteria niet aanpassen omdat RTG eraan verdient.

De vorm die dat oplost is openheid en geen zwijgen:

> *"U kunt uzelf blijven managen, uw huidige manager koppelen, een externe
> manager zoeken, of RTG Management spreken. RTG verdient aan die laatste."*

Dat is bovendien de enige variant die overleeft naast de bestaande regel dat de
AI nooit zelf toegang belooft of verleent.

### 4e. MN-03 als toets: een vooruitgeschoven post (13 september 2026)

MN-01 en MN-02 waren te beproeven omdat hun onderwerp bestond. MN-03 niet, en dat
is **gemeten en geen aanname**:

| Aanname waarop MN-03 rust | Stand |
|---|---|
| RTG verdient niets aan de omzet van een partner | `PARTNER_COMMISSIE = 0` in `kern/commercie/vergoeding.js` -- een INVARIANT, geen instelling, geen boardroomknop |
| RTG is zelf geen partij in een keuzepad | 9 hoedanigheden in `kern/vertegenwoordiging/bevoegdheden.js`, allemaal een MENS; "RTG Management" komt in `server/` en `public/` **nul keer** voor |

**MN-03 heeft dus vandaag geen onderwerp, en dat is een eigenschap van het product
en geen toeval.** Beveelt de AI een partner aan, dan is er geen belang om te
melden -- niet omdat we het verzwijgen, maar omdat het er niet is. Er is geen RTG
Management om bovenaan te zetten.

**Daarom bewaakt `test/mn03-commercieelvoordeel.test.js` niet de openbaarmaking
maar de twee AANNAMES**, en hij zakt op de dag dat een ervan verschuift. Dan
krijgt MN-03 een onderwerp, en dan hoort er een keuzepad te komen dat het belang
noemt -- de zin uit MN-03 hierboven, met *"RTG verdient aan die laatste"* erin.
De foutmelding zegt dat er ook bij: *deze toets hoort dan niet te worden
aangepast maar VERVANGEN door een proef op het keuzepad.*

**Waarom een tripdraad en geen gebouwde openbaarmaking.** Een keuzepad bouwen met
een vierde optie die niet bestaat, is het product verzinnen om de regel te kunnen
toetsen -- en dan toetst de toets zijn eigen fictie. Dezelfde grond als
AI-CONTEXT-02 in par. 4d, dat ook bewust geen handhaver heeft: er valt niets te
bewaken, en een schijnbewaker is erger dan een uitgeschreven gat.

Vier bewijzen, vier mutaties, elk door precies zijn eigen zaak gepakt: de
commissie op 12 (toets 1), `rtg-management` als hoedanigheid (toets 2), de
hoedanigheden leeggemaakt (toets 3, de TEGENproef -- sloop de laag en er is per
definitie geen commercieel voordeel), en de weigering teruggebracht tot "Nee."
(toets 4). Die laatste draagt de tweede helft van MN-03: de regel wordt opgelost
met **openheid en niet met zwijgen**, dus een weigering die niet uitlegt wat RTG
dan wél rekent, is alsnog zwijgen.

### De vier eronder

| # | Regel | Handhaver |
|---|---|---|
| MN-04 | **De managementvergoeding is geen omzetcommissie.** De 0%-belofte over platformomzet beweegt niet; een managementfee hangt aan benoemde diensten en aan door RTG gesloten deals. | `kern/commercie/vergoeding.js` voor de platformkant; de managementkant bestaat niet |
| MN-05 | **Exclusiviteit is nooit een voorwaarde voor infrastructuur.** Wie RTG Management verlaat, houdt account, loopbaan, rechten en team. | de uitstaptoets van `CARRIERE.md` par. 5 -- niet gebouwd |
| MN-06 | **Vertrek is een knop en geen gesprek.** Intrekken kan per direct, zonder tussenkomst van wie wordt ingetrokken. | `kern/vertegenwoordiging/acties.js` -- staat |
| MN-07 | **RTG stelt geen oordeel vast over de vertegenwoordiger van iemand anders.** Feiten uit een contract mogen; een kwalificatie is `advies` en draagt zijn klasse. | par. 2.6 -- de juridische zekerheidsindeling bestaat niet |

Van de zeven hebben er vandaag **drie** een handhaver (MN-01, MN-02, MN-06). Dat
is de eerlijke stand, en het is dezelfde waarin `KANTOOR.md` par. 13 zijn tien
wetten aantrof.

> **13 september 2026:** MN-01 stond hier als *"deels"*, en dat woord dekte iets
> ongemakkelijks: de regel werd afgedwongen door een AFWEZIGHEID. Er was geen
> kantoorweg naar een machtiging, en wie er morgen een toevoegde brak de regel
> zonder dat er iets rood werd. `test/mn01-bevoegdheidsvoordeel.test.js` maakt
> er een bewering van die kan zakken -- zie par. 4a.

**MN-04 verdient een waarschuwing apart.** Tot 20 augustus 2026 had de boardroom
een generieke commissieknop: standaard 12 procent, per genre te zetten, tot 30
procent. Die is eruit gehaald omdat het huis zichzelf op drie manieren tegensprak
over hetzelfde getal. Een managementfee als percentage van "alles wat iemand
verdient" is die knop terug. De vorm die wél kan is die van de vier benoemde
vergoedingen: **per inkomstensoort, vooraf zichtbaar, en nul waar RTG niets heeft
gedaan.**

---

## 5. De acquisitie

### 5.1 De vier kanalen

| Kanaal | Stand |
|---|---|
| De publieke voordeur (`index.html`, `/site/passen/`, `/site/werelden/`) | **staat**, maar spreekt per pas en per wereld |
| Het aanmeldgesprek met Rahul | **staat**, kent dit onderwerp niet |
| Het kantoor kent rugdekking toe | **staat, en is per definitie outbound** |
| Via de organisatie: club, bond, festival, label | **het sterkste kanaal, en ongebruikt** |

Het vierde heeft al een haakje: een zaak kan vanaf haar eigen account een regel
in het loopbaanboek **bevestigen** (`supplierAuth`) -- precies de handeling
waarmee een club aantoont dat iemand bij haar hoort. En de grens staat er al bij:
een club kan bevestigen maar niet voorstellen. Het lid schrijft, een ander
bevestigt.

En de eigenschap die dat kanaal draagt: **de mens wordt geen bezit van de
organisatie.** Verandert hij van club, dan vervalt de clubtoegang en blijven
loopbaan, team, rechten en account staan.

### 5.2 De drie gaten, gemeten

**Rugdekking heeft geen scherm.** De functieschakelaar heet *"Rugdekking (wie
staat er achter mij)"*, staat standaard aan, `/api/rugdekking/mijn` bestaat -- en
geen enkel bestand in `public/` roept die route aan, en er is geen ingang in
`MAPPEN`. De mens om wie het gaat kan niet zien dat RTG achter hem staat. Dat is
het eerste wat af moet, en niet als administratief label: wat het programma is,
sinds wanneer, wie de contactpersoon is, wanneer de volgende evaluatie valt, en
even groot ernaast wat het **niet** is -- geen eigendom, geen omzetcommissie,
geen overdracht van rechten.

**Er is geen aanmeldweg.** `routes/rugdekking.js` kent alleen `lijst` en `mijn`,
allebei lezend. Het merk beschrijft een programma, de mens meldt zich aan --
alleen toevoegen, nooit afstrepen.

**De A3-poort staat vóór het sterkste argument.** "Mijn team" gaat pas open als
RTG het identiteitsbewijs heeft gezien. Dat is met opzet, en het betekent dat
verificatie **onderdeel van de onboarding** is en niet iets van later.

---

## 6. De grenzen die niet mogen sneuvelen

Bovenop die van `CARRIERE.md` en `RUGDEKKING.md`, die onverkort blijven gelden.

1. **Er komt geen trede, balk of bedrag op een mens** -- niet publiek, niet
   intern, niet als sorteersleutel. Meten mag, op het niveau van het programma.
2. **Delegatie blijft uitgesloten.** Een team is meerdere machtigingen; een lead
   stelt voor en verleent nooit (par. 3).
3. **Een hoedanigheid draagt niet over.** Kennis of bevoegdheid uit de ene rol
   reist niet mee naar de andere -- ook niet via een export, een rapport, een
   cache of de context van de AI. En het systeem wisselt nooit vanzelf van
   context (MN-02).
4. **Een belofte over een spoor is pas een regel als het spoor kan weigeren.**
   Logging naast een handeling is een bedoeling; logging vóór een handeling is
   een grens (par. 0.6). En "er kwam geen fout uit" is geen registratie zolang de
   commit niet vaststaat.

5. **Een mens hoeft niet beoordeeld te worden om binnen te komen** (par. 0.1).
6. **Een merk zoekt geen mensen.** Het beschrijft een programma; de mens meldt
   zich aan.
7. **Een bewijs zegt wat het niet zegt, even groot** -- de vorm die
   `rtgid-bewijs.js` en het Career Ledger allebei al dragen.
8. **Rechten over gelijkenis kennen geen stilzwijgende ja.** AI-training en
   synthetische stem zijn aparte vragen, nooit onderdeel van "beeldgebruik".
9. **De audiencerelatie is van de mens die volgt.** Een artiest kan zijn publiek
   bedienen; hij krijgt er geen adreslijst van.
10. **Herkomst en registratie worden nooit vermengd** (par. 9).
11. **Plaats een garantie waar alle informatie voor die garantie samenkomt, niet
    zo vroeg mogelijk in de keten.** Uit besluit 5 en uitgeschreven daar: de
    kluispoort kent de MENS en niet het onderwerp; het journaal kent het
    onderwerp en niet wat er zou worden getoond. Vroeg in de keten voelt veilig
    en weigert het verkeerde.
12. **Een spoor zegt wat het beweert en nooit meer.** `toegestaan` is niet
    `geleverd`; een regel die claimt dat er is ingezien, liegt bij elke mislukte
    lezing -- en in het voordeel van het huis. Falen mag alleen de kant op waar
    het lid te veel te zien krijgt en niet te weinig.
13. **Een register dat niet is hergedraaid, is een bewering over het verleden.**
    Zeven "openstaande gebreken" van deze ronde waren al gerepareerd; alleen het
    ingecheckte bestand wist het niet. Een uitslag zonder verse stempel telt niet
    als stand -- dezelfde regel die `BESTUUR.md` al stelt met *vervallen bewijs
    is geen bewijs*, nu op een meting in plaats van op een control.
14. **Een regel op een afdwinglijst noemt een ROUTE en niet een handeling.**
    `/api/bank/akkoord` stond op de duurzaamheidslijst terwijl de helft die
    juridisch iets betekent -- de instemming zelf -- er niet onder viel. Wie een
    route op zo'n lijst zet, schrijft erbij WELKE handeling gedekt is.

---

## 7. De volgorde: drie poorten vóór het besluit

De belangrijkste wijziging in deze versie. De eerste drie zijn constitutionele
poorten en geen taken: ze staan vóór de dienst die ze moet beteugelen, want een
grens die ná het belang komt is geen grens.

| # | Onderdeel | Stand |
|---|---|---|
| **0** | **De faalproef een kantoorsessie op naam geven** -- zonder die stap is de gevoelige kantoorkant niet te beproeven en is besluit 5 niet te bewijzen | **staat** (13 sept): `kantoor-a` en `kantoor-b`, en het vier-ogenprincipe is voor het eerst gemeten |
| **0b** | **Besluit 5 zelf** -- geen aantoonbaar journaal, geen inzage | **staat** aan de ledenbalie; de andere 41 aanroepers van `noteer()` gaan per plek om |
| **1** | **Rugdekking zichtbaar maken** -- een mens moet kunnen zien dat de relatie bestaat | **een halve dag** |
| **2a** | **MN-01 als toets** -- geen bevoegdheidsvoordeel | **staat** (13 sept): zeven bewijzen, vijf mutaties gezien zakken -- par. 4a |
| **2b** | **MN-02 als toets** -- geen kennis die overdraagt tussen hoedanigheden | **staat** (13 sept): vier bewijzen met een TEGENproef, vier mutaties gezien zakken -- par. 4b |
| **2c** | **MN-02-AI** -- de contextbouwer van Rahul lekt niet tussen hoedanigheden | **staat** (13 sept): zeven bewijzen met twee TEGENproeven en een besturingsproef, vijf mutaties gezien zakken; de meting eronder is `AICONTEXT.json` -- par. 4c |
| **2d** | **MN-03 als toets** -- geen commercieel voordeel | **staat als VOORUITGESCHOVEN POST** (13 sept): de regel heeft vandaag geen onderwerp (commissie nul, RTG geen hoedanigheid), dus bewaakt de toets die twee aannames en zakt zodra een ervan verschuift -- vier bewijzen, vier mutaties, par. 4e |
| **3** | **MN-03 als regel** -- vóór RTG zichzelf ooit als optie presenteert | **een stap weg** |
| **4** | **Besluit: wordt RTG juridisch en commercieel vertegenwoordiger?** | **een besluit van de eigenaar** |
| **5** | **Eén intern testtalent, een volledige synthetische loopbaan** | **na 4** -- zie hieronder |
| 6 | Aanmeldweg voor een programma | een stap weg |
| 7 | Doelgroeppagina + `talentmens` in het aanmeldgesprek | een stap weg |
| 8 | Machtigingsbundel (par. 3) | een stap weg |
| 9 | Rosterwerkblad voor een manager | een stap weg -- het gegeven bestaat |
| 10 | Clubuitnodiging + bevestiging | een stap weg -- het haakje bestaat |
| 11 | Jeugd: maximumduur, geen verborgen exclusiviteit, herbeoordeling op 18 | een besluit |
| 12 | Juridische zekerheidsindeling | een besluit -- staat vóór 13 |
| 13 | Second opinion op een managementcontract | een besluit -- ná 12 |
| 14 | `rechtenregister` (gebied, kanaal, looptijd, exclusiviteit, AI-gebruik) | een besluit |
| 15 | Gelijkenisgrendel | een besluit -- ná 14 |
| 16 | VC 2.0 / OpenID4VCI onder de bestaande Bewijsmap | een besluit over formaat, geen functioneel gat |
| 17 | Contentherkomst | een besluit -- par. 9 |
| 18 | Uitbetalen aan een mens (CAR-01) | een besluit, en `GIFT.md` staat ervóór |
| 19 | Voorstelkamer voor een merk | jaren weg |
| 20 | Kansen matchen | jaren weg, en alleen in de omgekeerde vorm |

**Regel 5 verdient zijn eigen vorm, en die bestaat al.** Dit huis heeft drie
ketenproeven (`tafelproef.js`, `ritproef.js`, `toelatingsproef.js`) die een hele
keten écht lopen en per SCHAKEL en per STORING meten. De vierde hoort hier, en
hij is met opzet geen talentketen maar de eerste **mens-relatie-keten**: één
synthetische mens -- Mila, achttien, zelf beheerd, met een actieve bewijsmap --
die twaalf overgangen doorloopt.

En wat hij werkelijk meet is niet *kan een mens van manager wisselen*, maar:
**blijven identiteit, bevoegdheid, kennis en bewijs correct gescheiden terwijl
dezelfde mens door verschillende relaties en hoedanigheden beweegt?** Dat is de
vraag waar de meeste systemen alleen een beleidstekst over hebben.

| # | Schakel | Wat bewezen wordt |
|---|---|---|
| 1 | zelf beheerd | zij bestuurt haar loopbaan zonder dat iemand haar beoordeelt |
| 2 | externe manager erbij | die ziet uitsluitend zijn scope |
| 3 | specialist voorgesteld | de manager kan hem **niet** zelf machtigen |
| 4 | co-management | de cliënt machtigt de specialist apart |
| 5 | RTG Management erbij | exact dezelfde rail, geen kantoorweg |
| 6 | die RTG-manager heeft óók ledenbaliewerk | hier wordt MN-02 aangevallen |
| 7 | kantooropvraging | reden, minimale gegevens, journaal, melding |
| 8 | terug naar de managercontext | die gegevens zijn daar niet verschenen |
| 9 | RTG Management ingetrokken | per direct weg |
| 10 | de externe manager blijft | zijn bevoegdheid verandert niet mee |
| 11 | manager vervangen | de overdracht laat geen gat |
| 12 | vertrek | loopbaan, bewijsmap, identiteit en geschiedenis blijven bij haar |

En daarna de storingen, want daar zat bij alle drie de bestaande ketens de
winst -- elk van hen vond iets dat geen enkele losse routetoets zag:

- een machtiging verloopt midden in een sessie;
- intrekking terwijl een voorstel wordt voorbereid;
- de RTG-manager wordt als werknemer gedeactiveerd terwijl zijn
  cliëntmachtiging nog loopt;
- de cliëntmachtiging wordt ingetrokken terwijl de kantoorrol blijft;
- een specialist probeert een oude URL opnieuw;
- de AI heeft nog een oude contextsnapshot;
- twee vertegenwoordigers wijzigen tegelijk hetzelfde voorstel;
- de cliënt wordt tijdens de overdracht achttien;
- een managerwissel halverwege een lopend voorstel;
- **het inzagejournaal kan niet schrijven.**

Die laatste is geen hypothese meer: par. 0.6 meet dat de inzage vandaag gewoon
doorgaat en dat de aanroeper het niet merkt. De proef hoort dus te beginnen bij
de stand die er is, en het besluit eronder is besluit 5.


---

## 8. De besluiten voor de eigenaar

### Besluit 1 -- Wordt RTG zelf vertegenwoordiger?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Ja, maar pas na poort 1-3** *(aanbevolen)* | De dienst komt er, en de drie grenzen staan er eerder dan het belang. | Enkele dagen voor de poorten; daarna een dienst met mensen erin. |
| B. Ja, nu | Sneller een eerste cliënt. | Het belang bestaat dan eerder dan de grens -- de volgorde die dit huis elders vermijdt. |
| C. Nee, alleen infrastructuur | Geen belangenconflict, niets uit te leggen. | Dan is RTG voor een talent gereedschap, en het gesprek over zijn carrière voert iemand anders. |

### Besluit 2 -- De managementvergoeding

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Per inkomstensoort, vooraf zichtbaar** *(aanbevolen)* | Nul waar RTG niets deed; een afgesproken percentage op deals die RTG sloot. | Een vijfde benoemde vergoeding naast de vier bestaande. |
| B. Vast maandbedrag | Simpel, en het raakt de 0%-belofte nergens. | Een beginnend talent betaalt voor werk dat nog niets oplevert. |
| C. Percentage over alles | Zoals de markt het doet. | **Dit is de commissieknop terug** (MN-04). |

### Besluit 3 -- Het rechtenregister

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Bouwen, en beginnen bij AI-gebruik** *(aanbevolen)* | Het enige onderdeel dat voor makers werkelijk onderscheidend is, en het urgentste. | Middelgroot. De conflictcontrole is het werk, niet de opslag. |
| B. Alleen registreren, geen controle | Sneller. | Een register dat geen conflict signaleert, is een spreadsheet. |
| C. Niet | -- | Dan blijft het aanbod voor makers administratie zonder bescherming. |

### Besluit 4 -- Het formaat onder de Bewijsmap

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Eigen vorm houden, standaard later** *(aanbevolen)* | De Bewijsmap werkt en is streng. Een standaard eronder is interoperabiliteit, geen functie. | Nul nu; de vraag komt terug zodra een derde partij moet kunnen verifiëren. |
| B. Nu op VC 2.0 / OpenID4VCI | Externe verifieerbaarheid vanaf dag één. | Middelgroot, en het raakt een laag die vandaag bewezen goed werkt. |

### Besluit 5 -- Wat gebeurt er als het inzagejournaal niet kan schrijven?

Par. 0.6 meet dat dit vandaag al beantwoord wordt, en niet door iemand die het
besloten heeft: de inzage gaat door en de aanroeper merkt niets.

De regel in één zin: **geen gevoelige kantoorinzage zonder aantoonbaar geslaagde
journaalregistratie.**

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Geen aantoonbaar journaal, geen inzage** *(gekozen, en gebouwd)* | Eén contract bij het journaal en de gevoelige leesweg: eerst duurzaam geregistreerd, dan pas gelezen. Lukt dat niet, dan komt het dossier er niet uit. | Eén plek, niet 42 aanroepers -- maar **niet** de kluispoort: die is een identiteitspoort en kent het onderwerp van de inzage niet (par. 0.7). Een opslagstoring legt dan de zware inzage stil. |
| B. Inzage door, maar luid | De blik mag doorgaan; het mislukken wordt een incident in plaats van een lege `catch`. | Goedkoper, en "elke blik laat een spoor na" blijft dan een belofte over de bedoeling. |
| C. Laten zoals het is | -- | Dan staat er een belofte in `ledenbalie.js` die het huis niet kan waarmaken. |

**Bij optie A hoort een tweede invariant, en zonder die tweede is de eerste een
schijnoplossing.** "Geregistreerd" mag niet betekenen *`noteer()` gooide geen
fout*, maar *de commit die deze regel draagt is geslaagd* -- in PostgreSQL-modus
dus de autoritatieve commit van de responsepoort, en binnen een bundel het einde
van `bijeen()`. Anders verschuift het probleem van een genegeerde uitzondering
naar een valse bevestiging, en die is erger: hij ziet eruit als bewijs.

Dat is bovendien **beproefbaar zonder iets nieuws te bouwen**: `schrijf-verloren`
en `schrijf-faalt` bestaan al in `server/lib/verraad.js`, het duurzame primitief
staat in `db/duurzaam.js` met een poort op zijn aanroeperslijst, en
`FAALPROEF.json` is de klasse-meting. De toets bij dit besluit is dus niet "werkt
de weg" maar **"weigert hij onder `schrijf-verloren`"** -- precies het geval dat
vandaag stil goed gaat.

**Er stond een stap vóór, en die is gezet.** De proef kwam binnen met de gedeelde
kantoorcode, de kluispoort weigerde die terecht, en daardoor was 528 van de 570
kantoorroutes `ongemeten`. Besluit 5 bouwen zonder die stap zou een poort
opleveren waarvan niemand kan laten zien dat hij weigert -- en `niet vast te
stellen` is in dit huis een eersteklas uitslag naast in orde en storing
(`BESTUUR.md`), geen groen.

### Besluit 5 is genomen: A, en hij staat (13 september 2026)

`server/kern/ledenbalie-inzage.js` draagt de regel, `inzagelog.noteerVast()`
levert de uitslag, en `test/ledenbaliespoor.test.js` houdt hem vast. Onder beide
verraadstanden komt er geen dossier, geen trefferlijst en geen herstelbericht
meer uit -- met de mutatie erin levert dezelfde route weer 200 met de codenaam.

Drie dingen daaraan die je nergens anders moet herhalen.

**De plek is gekozen en niet zo vroeg mogelijk.** Niet in `kluispoort.js`: dat is
een IDENTITEITSpoort die vóór de route draait en het onderwerp van de inzage niet
kent. Niet in het journaal zelf: dat weet niet wat er zou worden getoond, en een
poort die weigert zonder te weten waarover, weigert het verkeerde. De regel die
eruit volgt geldt breder dan deze deur: **plaats een garantie waar alle
informatie voor die garantie samenkomt, niet zo vroeg mogelijk in de keten** --
hier is dat de plek waar WIE, WAAROM en OVER WIE tegelijk bekend zijn.

**Het journaal zegt `toegestaan` en nooit `geleverd`.** De regel wordt geschreven
vóór het dossier wordt samengesteld, dus hij legt vast dat inzage is VERLEEND --
en dat blijft waar als het lezen daarna stukloopt. Zou er `ingezien` staan, dan
liegt het spoor bij elke mislukte lezing, in het VOORDEEL van het huis, en dat is
de verkeerde kant om te falen. Andersom is het veilig: een lid dat leest dat
iemand toegang kreeg terwijl er niets op diens scherm verscheen, weet iets
kloppends. Elke regel draagt daarnaast `vast`: heeft de opslag DEZE regel
bevestigd? `noteer()` kan dat niet zeggen en `noteerVast()` wel, en die twee
mogen niet op een hoop -- *een spoor dat niet kan zeggen hoe hard het zelf staat,
is geen bewijs*.

**De andere 41 aanroepers van `noteer()` blijven staan, en dat is een besluit.**
Ze gaan per plek om, met een reden: bij een lijstscherm dat een naam toont is
weigeren iets anders dan bij het openen van een identiteitskluis. Wat hier is
vastgelegd is de VORM, niet de uitrol -- en een toets die nu zou vastleggen dat
de rest write-behind is, houdt de volgende stap tegen in plaats van hem te
bewaken.

Wat er NIET mee is opgelost: besluit 6 (de bewaargarantie) en besluit 7 (de
twaalfde LAT-regel) staan onveranderd open. B blijft daarmee een verdedigbare
keuze voor lichtere leeswegen; de afweging gaat niet over veiligheid maar over
beschikbaarheid, en die is per weg anders.

### Besluit 6 -- Wat is de bewaargarantie van het journaal?

Dit is een apart besluit en geen bijzin bij besluit 5. Het journaal is een
ringbuffer: `MAX = 5000`, en loopt hij vol dan valt de oudste eraf. Dat is geen
bug zolang de belofte eerlijk is -- maar *"u kunt zien wie uw dossier heeft
bekeken"* en *"wij bewaren de laatste vijfduizend inzages"* zijn twee
verschillende beloften, en vandaag staat alleen de eerste op het scherm.

**De hashketen lost dit niet op.** `lib/keten.js` bewijst de integriteit van wat
er staat; hij zegt niets over wat eraf gevallen is. Integriteit en retentie zijn
twee eigenschappen, en de ene wordt hier makkelijk voor de andere aangezien.

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Een termijn vastleggen en die tonen** *(aanbevolen)* | Niet een aantal regels maar een tijd, met wat er daarna gebeurt (vervallen of archiveren), en dat staat waar het lid het leest. | Klein als het vervallen is, groter als het archiveren wordt. |
| B. Aantal regels, eerlijk benoemd | Laat de 5000 staan en zeg het erbij. | Een grens die met het gebruik meebeweegt: bij druk verkeer is de horizon korter dan bij rustig, en niemand ziet dat. |
| C. Archiveren met een anker | De afgevallen staart blijft controleerbaar buiten de database. | Het duurst, en `AFSPRAAK.md` waarschuwt al: een anker in dezelfde database is geen anker. |

#### Besluit 6 is genomen: A, en hij staat (13 september 2026)

**De bewaring volgt de belofte, en niet andersom.** `server/inzagelog-bewaring.js`
houdt de termijn op EEN plek: `BEWAARDAGEN = 730`, en dat is een keuze met een
grond -- het inzagejournaal is het bewijs OVER toegang, dus het hoort de gegevens
waarover het gaat te overleven. Het identiteitsbewijs zelf valt na een jaar
(`server/bewaarveger.js`); het spoor dat iemand ernaar keek blijft daar een jaar
overheen staan.

**`MAX` is gebleven, maar het is nu een NOODREM en geen bewaartermijn.** 200.000
in plaats van 5.000, dus ruim boven wat de termijn oplevert -- en bijt hij toch,
dan telt het journaal dat (`inzageLogAfgekapt`) en zegt het antwoord het hardop.
Vier dingen daar niet wegpoetsen.

**Verjaren en afgekapt worden zijn twee soorten verlies en ze gaan nooit op een
hoop.** Een regel die VERJAART is de bewaartermijn die werkt; een regel die door
de noodrem valt is de belofte die breekt. Alleen de tweede wordt geteld, want
alleen de tweede is een tekort -- wie ze samentelt verbergt het tekort in het
normale verloop.

**De belofte reist mee met het antwoord.** `voorBetrokkene()` gaf een kale array
terug, en dan raadt het scherm wat zij betekent: het raadt *"dit is alles"*,
terwijl het *"dit is alles binnen de termijn"* is. Het antwoord draagt nu
`bewaardagen`, een uitgeschreven `belofte`, een expliciet `volledig` en bij een
tekort de zin die dat zegt. Nul is daar een UITSPRAAK en geen leeg veld: het zegt
dat de noodrem nooit heeft gebeten, en dus dat de termijn de hele belofte draagt.

**De vormwijziging legde drie productie-lezers bloot die er niet zouden zijn.**
De eerste aanname was dat `voorBetrokkene()` geen aanroepers had; er zijn er
drie, en twee toetsen stonden er rood door. Alle drie zijn AANGESLOTEN in plaats
van teruggedraaid, want juist daar hoort de belofte te landen:

| Lezer | Wat hij nu draagt |
|---|---|
| `kern/inzagekaart.js` | `bewaring` **per bron** -- het journaal kent zijn termijn, RTG iD en de paspoortlaag houden hun eigen bewaring bij en deze laag weet die niet. `null` is daar een uitspraak, en de onbekende helft staat even groot op het scherm. |
| idem | bijt de noodrem, dan verschijnt dat tekort in `nietZichtbaar` -- in dezelfde lijst als de rest van wat de kaart niet kan tonen, want dat is precies wat het is. |
| `/api/privacy/inzage` en de AVG-export | `inzage` blijft de lijst (geen bestaand scherm merkt er iets van), `bewaring` staat ernaast. |

**Een getal over vier bronnen zou de langste of de kortste tot waarheid maken,
en allebei is onwaar.** Daarom per bron en niet als een cijfer over het geheel --
dezelfde regel als overal in dit huis: er staat nooit een getal waar er geen is.

### Besluit 7 -- Wordt dit een eigen regel van `LAT.md`?

Grens 4 van par. 6 is hier geformuleerd voor het inzagejournaal, maar hij gaat
nergens specifiek over inzage:

> **Een belofte over een spoor is pas een regel als het spoor kan weigeren.**

Dezelfde vraag staat open bij financiële logging, bij consent, bij het
mutatiebewijs, bij het akkoord op voorwaarden en bij gevoelige AI-handelingen --
overal waar dit huis zegt dat iets wordt vastgelegd. `LAT.md` is de plek voor een
regel die overal geldt, en zijn regels komen allemaal uit een fout die hier écht
is gemaakt. Deze heeft die fout nu ook.

**GENOMEN OP 13 SEPTEMBER 2026, OPTIE A: hij staat in `LAT.md` als regel 18** --
niet als twaalfde, zoals dit document eerst schreef. Die was al bezet door *een
meting die niet heeft gedraaid is geen slechte uitslag*, en een document dat de
regels van een ander document nummert zonder te tellen, is zelf een geval van
LAT-regel 4. De regel kwam binnen mét zijn handhaver, precies wat optie A
vroeg: besluit 5 was al gebouwd (`inzagelog.noteerVast()` +
`kern/ledenbalie-inzage.js`, par. 0.6a), en daarnaast staat nu de meter die de
KLASSE telt.

**De omvang was geschat en is nu gemeten** (`npm run stilspoor`,
`STILSPOOR.json`). De eerste schatting was een grep: 468 lege `catch`-blokken in
`server/`, waarvan 13 letterlijk `try { save(); } catch`. De meter leest het lijf
GEBALANCEERD -- dus ook een smoring die over meerdere regels loopt -- gaat de
hele boom af, en telt een lijf met alleen een toelichting als leeg. Dat laatste
is het punt en geen tekortkoming: **een commentaar maakt een smoring niet minder
stil**, en wie de bron ruw leest telt juist de best toegelichte smoringen als
afgehandeld. Het zijn daarmee twee verschillende metingen en ze horen niet te
worden vergeleken of opgeteld.

| | gemeten |
|---|---|
| bronbestanden in `server/` | 3424 |
| `catch`-blokken | 1841 |
| daarvan volledig leeg | 674 |
| **SPOOR-schrijvers gesmoord** | **18** (van 221 aanroepen) |
| **OPSLAG-schrijvers gesmoord** | **24** (van 3193 aanroepen) |

Dat getal is een **vorm en geen aanklacht**, in de zin van `DOODSPOOR.json`.
Veruit de meeste lege catches zijn terecht, en dat geldt ook binnen de
tweeënveertig: `server/log.js` smoort `noteerFout` omdat een logger die zelf
gooit de oorspronkelijke fout maskeert, en `kern/envelop.js` zegt met zoveel
woorden dat de LEVERING voorgaat -- een geweigerde actor houdt een melding nooit
tegen. De uitweg is daarom niet een uitzonderingenlijst in de meter maar een
**besluitregister ernaast**, in de vorm van `HERREKENBAAR.json` naast
`FAALPROEF.json`: een verklaring is een besluit en wordt **nooit van de telling
afgetrokken**. Dat register bestaat nog niet, en met opzet -- er is nog geen
enkel besluit genomen, en een leeg besluitregister is een belofte die niemand
heeft gedaan. De haak ligt er (`STILSPOORBESLUIT.json`); wie het eerste besluit
neemt, schrijft het bestand en de telling splitst vanzelf.

**Drie ratels, en ze doen niet hetzelfde.** `stilSpoor` en `stilleOpslag` mogen
alleen omlaag: dat is de schuld. Ze staan apart omdat het twee beloftes zijn --
bij de eerste verdwijnt het spoor, bij de tweede het gegeven -- en een optelling
verbergt welke van de twee bewoog. `stilSpoorAanroepen` mag alleen omhoog, want
de herkenning is lexicaal: een meter die stil minder spoor-schrijvers vindt,
meldt dezelfde lage schuld over minder bewijs. **Een schuld die daalt doordat het
instrument blind wordt, is de gevaarlijkste vorm van vooruitgang** -- dezelfde
tandvorm als bij `AICONTEXT.json`.

**En de meter maakte onderweg zelf de fout van `BEWIJSMACHINE.md` par. 6a.** De
eerste versie gaf per bevinding een regelnummer uit de bron ná
`zonderCommentaar()`, en die plet een blokcommentaar tot één spatie: elk
regelnummer erná schoof op. De uitslag zag er volkomen geldig uit -- 18 en 24,
dezelfde getallen -- en wees naar regels die in het echte bestand iets anders
bevatten. `zonderCommentaar(bron, { regelsHeel: true })` is de derde stand die
`scripts/lib/bron.js` in zijn kop al noemt; na die reparatie wijzen alle 42
plekken op een `catch`, nagelopen met `sed`. Een handhaver van een regel over
stille fouten, die zelf stil de verkeerde regel aanwees.

---

## 9. De standaarden, nageslagen

`CARRIERE.md` par. 3 legde vast dat twee van de vier standaarden niet waren
nagekeken en dus `vermoed` waren. Dat is op 13 september 2026 gedaan; ze staan nu
als **gemeten**, met één correctie.

| Standaard | Stand |
|---|---|
| W3C Verifiable Credentials 2.0 | Recommendation (mei 2025) -- bevestigd |
| WebAuthn Level 3 | **W3C Recommendation sinds 25 augustus 2026** -- bevestigd |
| OpenID4VCI 1.0 | Final; zelfcertificering **sinds 26 februari 2026** -- de aangedragen datum (augustus 2026) klopt niet |
| C2PA / Content Credentials | versie **2.4**, april 2026 -- bevestigd |

**En herkomst is een signaal en geen bewijs.** Uploads, schermafdrukken, exports
en platformbewerkingen verwijderen of breken de metadata routinematig. Er komt
dus nooit een groen vinkje *"deze foto is echt"*. Wat er wel kan staan:

> Herkomstinformatie aanwezig. Deze informatie is cryptografisch controleerbaar,
> maar kan bij kopiëren, schermafdrukken of sommige exports verloren gaan. Het
> ontbreken ervan betekent daarom niet dat materiaal onbetrouwbaar is.

**En de twee claims worden nooit vermengd.** *"Dit bestand draagt herkomst van de
maker"* is iets anders dan *"RTG heeft dit bestand op 18 februari ontvangen"*.
Het tweede is een eigen, onafhankelijke registratie, en het bewijst geen
auteursrecht -- het bewijst dat iets op een moment bestond. Dezelfde discipline
als de drie herkomsten van het Career Ledger, waar bij elke bron staat wat zij
níét zegt.

---

## 10. Wat dit document NIET zegt

- Het zegt niet dat de onderdelen samen een product vormen. Dat ze op dezelfde
  mens passen, is een ontwerpvraag en geen gemeten feit -- de vorm daarvoor is de
  ketenproef, en die staat als regel 5 van par. 7 en is **niet gedraaid**.
- Het meet niet of de voorgestelde klassen mensen (performance, creative,
  creator, expertise, leadership, opkomend, maatschappelijk) iets delen. Dat is
  exact dezelfde claim als in `CARRIERE.md` par. 0, waar het antwoord over
  vijftien talentdomeinen **nul gedeelde velden** was. Bouw er geen indeling op
  voordat `npm run carrierevorm` erover heeft gelopen.
- Het zegt niets over bedragen: niet over een managementfee, niet over
  rugdekking, niet over wat een programma waard is.
- Het zegt niets over wie een programma verdient. Selectie is mensenwerk.
- Het beweert niet dat RTG Management een goed idee is. Het zegt wat er waar moet
  zijn voordat het er een kan worden.

---

## 11. De vraag die dit document heeft opgeleverd

Van de acht namen die dit ontwerp voorstelde bleken er vier bezet, en één --
`bewijsmap` -- bleek de functie die werd ontworpen al te ZIJN, gekozen langs
precies dezelfde redenering. Van de zeventien onderdelen stonden er zes, zes half,
en waren er vier werkelijk afwezig.

Dat is tegelijk een compliment en een waarschuwing. Het compliment: de
onderliggende architectuur is verder dan een inventaris van schermen doet
vermoeden. De waarschuwing: bij een nieuw plan is *"wat moeten we bouwen?"*
steeds vaker de verkeerde eerste vraag.

De goede eerste vraag is:

> **welke waarheid bestaat al, welke belofte denken we dat die waarheid geeft,
> en is die belofte ook aantoonbaar onder storing?**

Die derde helft is de nieuwe. Par. 0.6 is er het voorbeeld van: de waarheid
bestond (een journaal met een hashketen), de belofte leek te volgen ("elke blik
laat een spoor na"), en onder storing hield zij geen stand. Niemand had dat
verkeerd gedaan -- er was alleen nooit iemand die de derde vraag stelde.

Het werk verschuift daarmee van functies naar semantiek, bedrading en harde
invarianten. Dat is een moeilijker probleem, en een volwassener.
