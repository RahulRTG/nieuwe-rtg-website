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

**De reparatie hoort op één plek en niet in 42.** `kern/kantoor/kluispoort.js`
bestaat al als de poort voor de zware inzage (hij hangt vandaag aan 8 van de 585
kantoorroutes, `KANTOOR.md`). Daar hoort het contract te staan, en het is er ook
uitvoerbaar: **eerst aantoonbaar geregistreerd, dan pas gelezen.**

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

### De vier eronder

| # | Regel | Handhaver |
|---|---|---|
| MN-04 | **De managementvergoeding is geen omzetcommissie.** De 0%-belofte over platformomzet beweegt niet; een managementfee hangt aan benoemde diensten en aan door RTG gesloten deals. | `kern/commercie/vergoeding.js` voor de platformkant; de managementkant bestaat niet |
| MN-05 | **Exclusiviteit is nooit een voorwaarde voor infrastructuur.** Wie RTG Management verlaat, houdt account, loopbaan, rechten en team. | de uitstaptoets van `CARRIERE.md` par. 5 -- niet gebouwd |
| MN-06 | **Vertrek is een knop en geen gesprek.** Intrekken kan per direct, zonder tussenkomst van wie wordt ingetrokken. | `kern/vertegenwoordiging/acties.js` -- staat |
| MN-07 | **RTG stelt geen oordeel vast over de vertegenwoordiger van iemand anders.** Feiten uit een contract mogen; een kwalificatie is `advies` en draagt zijn klasse. | par. 2.6 -- de juridische zekerheidsindeling bestaat niet |

Van de zeven hebben er vandaag **twee** een handhaver (MN-01 deels, MN-06). Dat
is de eerlijke stand, en het is dezelfde waarin `KANTOOR.md` par. 13 zijn tien
wetten aantrof.

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

---

## 7. De volgorde: drie poorten vóór het besluit

De belangrijkste wijziging in deze versie. De eerste drie zijn constitutionele
poorten en geen taken: ze staan vóór de dienst die ze moet beteugelen, want een
grens die ná het belang komt is geen grens.

| # | Onderdeel | Stand |
|---|---|---|
| **1** | **Rugdekking zichtbaar maken** -- een mens moet kunnen zien dat de relatie bestaat | **een halve dag** |
| **2** | **MN-01 + MN-02 als toets** -- geen macht- en geen informatievoordeel | **een stap weg**, en par. 0.5 zegt waar MN-02 begint |
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
| **A. Geen aantoonbaar journaal, geen inzage** *(aanbevolen)* | Eén contract in `kern/kantoor/kluispoort.js`: eerst geregistreerd, dan pas gelezen. Lukt de registratie niet, dan gaat de deur niet open. | Eén poort, niet 42 aanroepers. Een opslagstoring legt dan de zware inzage stil -- en dat is precies wat de belofte waard maakt. |
| B. Inzage door, maar luid | De blik mag doorgaan; het mislukken wordt een incident in plaats van een lege `catch`. | Goedkoper, en "elke blik laat een spoor na" blijft dan een belofte over de bedoeling. |
| C. Laten zoals het is | -- | Dan staat er een belofte in `ledenbalie.js` die het huis niet kan waarmaken. |

**Bij optie A hoort een tweede invariant, en zonder die tweede is de eerste een
schijnoplossing.** "Geregistreerd" mag niet betekenen *`noteer()` gooide geen
fout*, maar *de commit die deze regel draagt is geslaagd* -- in PostgreSQL-modus
dus de autoritatieve commit van de responsepoort, en binnen een bundel het einde
van `bijeen()`. Anders verschuift het probleem van een genegeerde uitzondering
naar een valse bevestiging, en die is erger: hij ziet eruit als bewijs.

Dat is bovendien **beproefbaar zonder iets nieuws te bouwen**: `schrijf-verloren`
en `schrijf-faalt` bestaan al in `server/lib/verraad.js`, acht toetsbestanden
gebruiken ze, en het journaal is er geen van. De toets bij dit besluit is dus
niet "werkt de poort" maar **"weigert de poort onder `schrijf-verloren`"** -- en
dat is precies het geval dat vandaag stil goed gaat.

A en B zijn allebei beter dan de huidige stand. De keuze gaat niet over
veiligheid maar over beschikbaarheid: A zet de zware inzage stil bij een
opslagstoring, B laat hem doorwerken met een luide melding.

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

### Besluit 7 -- Wordt dit de twaalfde regel van `LAT.md`?

Grens 4 van par. 6 is hier geformuleerd voor het inzagejournaal, maar hij gaat
nergens specifiek over inzage:

> **Een belofte over een spoor is pas een regel als het spoor kan weigeren.**

Dezelfde vraag staat open bij financiële logging, bij consent, bij het
mutatiebewijs, bij het akkoord op voorwaarden en bij gevoelige AI-handelingen --
overal waar dit huis zegt dat iets wordt vastgelegd. `LAT.md` is de plek voor een
regel die overal geldt, en zijn elf regels komen alle elf uit een fout die hier
écht is gemaakt. Deze zou de twaalfde zijn, en hij heeft die fout nu ook.

**De omvang is gemeten en hij is bewust ruw.** In `server/` staan **468** lege
`catch`-blokken, waarvan er **13** letterlijk de vorm `try { save(); } catch`
hebben -- dezelfde als `inzagelog.js`.

Dat getal is een **vorm en geen aanklacht**, in de zin van `DOODSPOOR.json`: veruit
de meeste lege catches zijn terecht (opruimwerk waar mislukken niet uitmaakt --
`try { res.destroy(err); } catch (e) {}` is geen bug). De dertien zijn de plekken
waar een duurzaamheidsfout wordt weggeslikt, en pas per stuk nakijken zegt of
daar ook een belofte boven hangt. Wat de meting wél vaststelt: de vorm is niet
uniek voor het journaal, en een regel die hem vangt heeft meer dan één klant.

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Ja, maar pas na de eerste handhaver** *(aanbevolen)* | De regel komt in `LAT.md` zodra besluit 5 gebouwd is, zodat hij met een werkend voorbeeld binnenkomt in plaats van als voornemen. | Een regel meer, en de dertien vragen dan een ronde: draagt hier een belofte boven? |
| B. Ja, nu | Sneller vastgelegd. | `LAT.md` zegt zelf dat een regel zonder handhaver een belofte is; dat zou de twaalfde regel meteen overtreden. |
| C. Nee, hij blijft van deze laag | Geen huisbrede belofte die niemand nakomt. | Dan wordt hij per domein opnieuw ontdekt, en dat is precies hoe deze er kwam. |

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
