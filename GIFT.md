# Giften aan de RTFoundation — het besluit vóór de knop

Dit document bestaat omdat er een doneerknop gevraagd is en die er met opzet
niet is. `server/kern/rtfos/donateur.js` zegt het in zijn eigen kop:

> **Wat er niet in zit: geen doneerknop en geen incasso.** Geld aannemen loopt
> via RTG Pay en de bank; dit is de verantwoording achteraf.

Dat is geen gat dat iemand vergeten is te vullen. Het is een grens, en er zitten
drie besluiten onder die niemand anders dan de eigenaar kan nemen. Dit document
maakt ze besluitbaar: wat er staat, wat er ontbreekt, wat elk besluit kost, en
welk ontwerp eruit volgt. **Er is nog geen regel code voor geschreven.**

Lees ernaast: `GELD.md` (geld verlaat het huis nooit vanzelf), `WAARDE.md`
(waardeklassen en de betaalpoort), `ECONOMIE.md` (de RTFoundation is een eigen
rechtspersoon met een eigen vermogen, en dat wordt afgedwongen) en
`CONTROLPLANE.md` (geen economische actie zonder bewijs).

---

## 1. Wat er vandaag staat, gemeten

De verantwoordingskant is af, en hij is streng. Dat is belangrijk om te weten
vóór je iets bouwt: de moeilijke helft bestaat al.

| onderdeel | waar | wat het doet |
|---|---|---|
| Het donateursportaal | `kern/rtfos/donateur.js` | Twee vragen: wat gaf ik, en waar ging het heen. Op een eigen code (RTFS-), nooit het bestand van een ander. |
| Het giftbewijs | `donateur.js: bewijsbaar()` | Geeft géén bewijs af waar het geen gift is: bij sponsoring, bij een tegenprestatie, bij goederen, en zolang de herkomst open staat. |
| De herkomstcontrole | `kern/rtfos/herkomst.js` | Boven € 10.000 (of € 500 contant) staat het geld stil tot een mens heeft gekeken. Niet een waarschuwing — geld dat niet beweegt. |
| Gift ≠ sponsoring | `herkomst.js` | Staat er iets tegenover, dan weigert het systeem de donatie en zegt waar hij wel thuishoort. |
| De bron | `kern/rtfos/geld-bron.js` | Een gift is een `bron` met een soort (`donatie`, `maandelijkse_donatie`, `sponsoring`, `goederen`), eventueel geoormerkt op een project. |
| De periodieke gift | `donateur.js: periodiekVast` | Heet alleen periodiek met een vastgelegde overeenkomst van ten minste vijf jaar. |
| De 30%-stroom | `app-main`, factuurregel | Van elke bijdrage gaat 30% naar de RTFoundation. Dit is vandaag de manier waarop de stichting aan geld komt. |

## 2. Wat er niet staat

1. **Geen ontvangende entiteit.** `/api/pay/stuur` stuurt geld naar een
   *codenaam*. Er is geen codenaam, wallet of positie van de RTFoundation om
   naartoe te betalen. Ik heb er geen verzonnen: dan gaat geld nergens heen.
2. **Geen doneerknop en geen incasso** — de regel hierboven.
3. **De ANBI-status is gemodelleerd, maar niet aangesloten — en niet voor
   onszelf.** Dit huis weet wat een ANBI is: `kern/foundationregistratie*.js`
   legt hem vast met een RSIN van negen cijfers en een verwijzing naar de
   voorwaarden van de Belastingdienst, en `kern/rtfos/partners.js` kent
   `anbi`, `rsin` en het documentsoort `anbi-beschikking`. Maar dat gaat over
   **anderen**: partnerstichtingen die zich bij de RTFoundation registreren.

   De giftlaag zelf leest hem nergens. Gemeten: `donateur.js`, `herkomst.js` en
   `geld-bron.js` noemen ANBI **nul keer**, en er is geen plek waar de status
   van de RTFoundation zélf staat — zij registreert anderen, niet zichzelf.
   Ondertussen geeft `donateur.js: bewijs()` wel een *giftbewijs* af. Een gift
   is alleen aftrekbaar als de ontvanger een ANBI is, dus dat bewijs leunt nu
   op een aanname die nergens is vastgelegd.

## 3. De drie besluiten

### Besluit 1 — Waar landt het geld?

`ECONOMIE.md` is hier hard: een rekening landt bij de **entiteit** van een
wereld, nooit bij een gebruiker ervan. Een gift hoort dus bij de RTFoundation
als rechtspersoon, en niet op een wallet die toevallig van een bestuurder is.

**GENOMEN (31 augustus 2026): de RTFoundation krijgt een eigen wallet zoals een
leverancier er een heeft, en betaalt zichzelf daarvandaan uit naar haar eigen
bankrekening.**

Dat is geen vierde optie naast de drie hieronder maar de scherpste vorm van de
eerste, en hij heeft een eigenschap die de andere twee misten: **er komt geen
betaalweg bij.** `kern/pay/partner.js` boekt al van een lid naar
`partner:<code>`, en uitbetalen naar de bank bestaat al als
`/api/pay/zaak/uitbetalen` — met de reserveringen die niet meeverhuizen, een
idempotentiesleutel, een betaalopdracht die opnieuw wordt ingediend met dezelfde
sleutel, en een eerlijke stand "in behandeling" in plaats van "gelukt". De
stichting is daarmee een houder van een wallet, niet een nieuwe geldstroom.

Wat je ervoor accepteert, en het staat op het scherm: **de transactiekosten komen
van de ontvanger af**, precies zoals bij elke andere ontvangst in dit huis. Een
gift van € 25 komt binnen als € 24,65. Een scherm dat "100% gaat naar de buurt"
zou beweren, zou dus liegen.

De drie opties zoals ze voorlagen:

| optie | wat het betekent | prijs |
|---|---|---|
| **A. Een positie in RTG Pay** — gekozen, als partnerwallet | Een gift is een boeking van lid naar de wallet van de stichting. | Blijft binnen het gesloten circuit. Het geld moet er wel weer uit naar de bank, en dat doet de stichting zelf langs de bestaande leveranciersweg. |
| **B. Rechtstreeks naar de bankrekening** | RTG zet de gift klaar; de betaling gaat via de betaalnaad naar de stichting. | Schoonste scheiding, maar vraagt een eigen betaalaanbieder op naam van de stichting. |
| **C. Allebei, met een schakelaar** | Klein bedrag via Pay, groot via de bank. | Twee wegen is twee keer verantwoorden. Afgeraden. |

### Besluit 2 — Neemt RTG online giften aan?

Dit is de knop zelf, en hij is niet los te zien van besluit 1. Drie vormen, en
ze verschillen in wat ze juridisch zijn:

- **eenmalig, ongeoormerkt** — het eenvoudigst; een gift aan de stichting.
- **eenmalig, geoormerkt op een project** — de gever verwacht dat het dáár
  heen gaat. Dat is een verplichting: `WAARDE.md` noemt dat een **oormerk** (u
  zet uw eigen geld apart, en dat blijft), niet een reservering (die vervalt).
  Het portaal moet die belofte dan ook kunnen waarmaken en tonen.
- **periodiek** — alleen met een vastgelegde overeenkomst van ten minste vijf
  jaar, en dat weet `donateur.js` al. Een knop die "maandelijks" zegt zonder die
  overeenkomst, kost de gever geld bij zijn aangifte.

### Besluit 3 — Is de RTFoundation zelf een ANBI, en waar staat dat?

Het model ligt er al (zie par. 2.3); wat ontbreekt is de eigen status én de
aansluiting op het bewijs. Bepalend voor de tekst op het scherm:

**GENOMEN (31 augustus 2026): nog geen ANBI, de aanvraag loopt.** Daarvoor is
`aangevraagd` een eigen stand geworden naast `onbekend`, `nee` en `ja` — vier
knopstanden, vier zinnen die met de knop meebewegen. Wat `aangevraagd` de gever
zegt is wat we weten en niet wat we hopen: *"of deze gift daarmee alsnog
aftrekbaar wordt, hangt af van de beschikking — dat zeggen wij niet toe."* Of een
beschikking terugwerkt, stelt dit systeem niet vast.

- **ja** → het RSIN (negen cijfers, afgedwongen) hoort zichtbaar op de pagina en
  het stuk heet giftbewijs.
- **aangevraagd** → ontvangstbevestiging, met de lopende aanvraag erbij en zonder
  toezegging.
- **nee** → ontvangstbevestiging, en het scherm zegt dat de gift niet aftrekbaar is.
- **onbekend** → ontvangstbevestiging, en het scherm zegt dat het niet vastligt.
  Dat is iets anders dan "nee", en het leest ook anders.

## 4. Het ontwerp dat eruit volgt

Zodra de drie besluiten er zijn, is dit de vorm — en hij leunt volledig op wat
er al staat.

**De schakelaar ís de positie.** Net als de terugstortstand in `CLAUDE.md`
(`WALLET_SALDO` is geen vaste soort maar afhankelijk van een schakelaar in de
boardroom) wordt de giftontvangst een stand die de eigenaar zet, en die stand
is het besluit. Standaard **dicht**. Staat hij dicht, dan bestaat de route wel
en weigert hij *met de reden* — geen grijze knop en geen verdwenen scherm.

**Klaarzetten, bevestigen doet de mens.** `GELD.md` par. 3 en `FABRIC.md`:
alles wat een derde raakt is maximaal klaarzetten. De knop bouwt een
*voorgenomen gift* (bedrag, doel, wel of niet anoniem, wel of niet periodiek) en
de mens bevestigt hem in de betaalstap. De AI beweegt hier geen geld — dat staat
al als grens in `WAARDE.md`.

**Vijf grendels die de bestaande laag al kent en die de knop moet erven:**

1. Een gift met een tegenprestatie is geen gift → `herkomst.js` weigert hem als
   donatie. Het formulier moet die vraag dus stellen vóór het bedrag.
2. Boven de drempel staat het geld stil tot een mens keek. Dat betekent dat het
   *bevestigingsscherm* eerlijk moet zeggen: dit bedrag wordt eerst beoordeeld.
3. Geen bewijs waar het geen bewijs is (`bewijsbaar()`), en bij besluit 3 = nee
   heet het sowieso anders.
4. Geoormerkt geld is een oormerk en geen reservering: het vervalt niet, en het
   portaal laat zien waar het heen ging.
5. Een gever krijgt een code (RTFS-) en ziet daarmee **alleen zijn eigen**
   giften. Nooit wie er nog meer gaf.

**En twee grenzen die de knop zelf moet toevoegen:**

6. **Minderjarigen geven niet online.** De buurtruil heeft die grens al langs de
   band (een eigen RTG-account heeft een beschermd kind niet); voor geld hoort
   hij expliciet te zijn.
7. **Een gift is terug te draaien binnen een termijn**, en dat staat vóór de
   knop op het scherm. `GRAMMATICA.md`: ongedaan vóór bevestigen — twintig keer
   "weet u het zeker?" leert mensen op ja drukken.

## 5. Wat er bewust niet komt

- **Geen thermometer, geen teller, geen "nog € 400 te gaan".** `publiek.js`
  zegt het al over campagnes: een thermometer werkt als aansporing, en dat is
  precies het soort druk dat dit huis niet op mensen zet. Dat geldt voor de
  doneerknop dubbel.
- **Geen incasso zonder overeenkomst**, en geen knop die "maandelijks" zegt
  terwijl het dat fiscaal niet is.
- **Geen ranglijst van gevers**, geen "top-donateurs", geen badge. Er komt geen
  score op een mens.
- **Geen automatische FIU-melding en geen sanctielijst-koppeling.**
  `herkomst.js` is daar expliciet over: een knop die "gecontroleerd" zegt zonder
  iets te controleren is gevaarlijker dan geen knop.

## 6. Wat er inmiddels staat (31 augustus 2026)

De drie besluiten zijn genomen en de keten is af: van klaarzetten tot een gift
die echt op de wallet van de stichting staat.

| bestand | wat het doet |
|---|---|
| `kern/rtfos/gift.js` | De **stand**: dicht of open, de wallet, de vormen, de ANBI-stand. Boardroom-only. Kan niet open zonder wallet en vorm, en de weigering zegt welke ontbreekt. |
| `kern/rtfos/gift-voornemen.js` | Het **voornemen**: wat er zou gebeuren. Gift of sponsoring, wel of niet eerst beoordeeld, en welk stuk je terugkrijgt. Betaalt niets. |
| `kern/rtfos/gift-betalen.js` | De **bevestiging**, en de enige plek in deze laag waar geld beweegt. Rekent het voornemen opnieuw, boekt via `pay.partnerIn`, en maakt daarna de bron. |
| `kern/rtfos/gift-vormen.js` | De drie woordenlijsten, één keer. |
| `kern/rtfos/geld-bron.js: bronUitGift` | De bron die uit een online gift ontstaat — derde naast subsidie en campagne, en met de herkomstcontrole erop, want dit is één gever en één bedrag. |
| `test/rtfos-gift.test.js` | 21 toetsen. Vijf mutaties op de betaalstap geprobeerd, alle vijf gepakt. |

**Nagelopen in het echte grootboek**, niet alleen in een toets: een gift van
€ 25 boekt `lid:… → partner:RTF-WALLET`, daarna `partner:RTF-WALLET →
rtg:betaaldienst` van € 0,35, en de wallet van de stichting staat op € 24,65.
Twee keer bevestigen met dezelfde idempotentiesleutel levert één gift op.

Vier dingen die uit het bouwen zelf kwamen:

- **De uitkomst wordt op de server opnieuw gerekend.** Wat de browser meestuurt
  over aftrekbaarheid of de naam van het stuk, telt niet mee; alleen invoer
  telt (bedrag, vorm, en of er iets tegenover staat).
- **De bron ontstaat ná de boeking.** Een bron zonder geld is een belofte in de
  boekhouding van de stichting; mislukt de registratie wél, dan staat dat in het
  antwoord in plaats van dat het verdwijnt.
- **Sponsoring krijgt een factuur**, geen ontvangstbevestiging — dat belooft
  `donateur.js` al.
- **Zonder betaallaag gebeurt er niets en wordt dat gezegd** (503, "er is niets
  afgeschreven"), in plaats van een lege tak die "ok" antwoordt.

### De periodieke gift (31 augustus 2026)

`kern/rtfos/gift-periodiek.js` maakt er een **plan** van in plaats van een vinkje
op één gift. Dat was de fout eronder: `donateur.js` hing `periodiek` aan één
bron, terwijl de afspraak over vijf jaar en vijf bedragen gaat — de volgende
termijn, de vraag of er al betaald is en wat er gebeurt als iemand stopt,
bestonden domweg niet.

Wat er nu staat: een gever stelt voor (bedrag per jaar, minstens vijf jaar), de
stichting legt de overeenkomst vast met een vindbaar kenmerk, en de termijnen
worden **afgeleid** uit startjaar en looptijd. Elke betaalde termijn wijst terug
naar de bron die eruit ontstond. Stoppen kan de gever zelf; wat dat betekent voor
zijn aangifte staat in de overeenkomst en niet in dit systeem.

Vier dingen die daarbij zijn rechtgezet of vastgelegd:

- **De ondergrens van vijf jaar stond op twee plekken.** Nu één keer, in
  `gift-vormen.js`; `donateur.js` leest hem daar.
- **De oude slotzin beloofde te veel.** `periodiekVast` zei onvoorwaardelijk
  *"aftrekbaar zonder drempel"*. Dat klopt alleen als de stichting een ANBI ís —
  zolang de aanvraag loopt is die zin onwaar op precies het moment dat iemand hem
  in zijn aangifte overneemt. Hij volgt nu de ANBI-stand.
- **Een jaarlijkse termijn heette `maandelijkse_donatie`.** Dat bronsoort loog
  over de frequentie; de periodiciteit hoort bij het plan, de bron is gewoon een
  donatie.
- **Alleen de termijn van dít jaar staat open.** Anders blijft er een knop staan
  terwijl het jaar al voldaan is: dan betaalt iemand wél en wordt er níéts
  afgetekend. Een tweede betaling in hetzelfde jaar gaat gewoon door — het geld
  is echt gegeven — maar meldt eerlijk dat er geen termijn mee is afgetekend.

### Het scherm (31 augustus 2026)

`/apps/foundation/geven.html` — twee stappen, en de eerste is niet decoratief.
Het scherm rekent zelf niets uit: het vraagt de server wat er zou gebeuren, toont
die zinnen letterlijk, en pas daarna kan er bevestigd worden. Dat is de volgorde
uit `GRAMMATICA.md`: een handeling met geld is plechtig, en die maakt een mens af
nadat hij de gevolgen heeft gezien. De transactiekosten staan er vooraf bij en na
afloop met het bedrag erbij dat werkelijk bij de stichting landt.

De schakelaar staat op het RTF-kantoor (`kantoor.html`, deel *Giften*): open of
dicht, de walletcode, en de ANBI-wissel met vier standen. Lezen mag het kantoor,
zetten alleen de boardroom — en dat oordeel valt op de server.

## 7. Wat er nog niet is

- **Het uitbetalen is niet gebouwd en hoeft dat ook niet**: de stichting logt in
  als houder van haar wallet en gebruikt `/api/pay/zaak/uitbetalen`. Daar een
  eigen knop naast zetten zou een tweede pad zijn voor dezelfde handeling.
- **De incasso.** Er is er geen, en hij komt er niet uit zichzelf: elke termijn
  wordt door de gever zelf bevestigd. Geld dat vanzelf van iemands rekening gaat,
  vraagt een machtiging en een eigen besluit.
- **En let op een derde plek waar ANBI al leeft.** `kern/rtfos/jaarverslag.js`
  opent met *"Een ANBI moet publiceren. Dat is geen nette gewoonte maar een
  voorwaarde"* en bouwt die publicatieplicht ook uit, onder `/publiek` en niet
  achter een inlog. Dat module gaat er dus van uit dat de stichting er een is,
  terwijl de giftstand nu vastlegt dat de aanvraag nog loopt. Die twee horen
  elkaar te vinden zodra de beschikking er is — vandaag spreken ze elkaar niet
  tegen op het scherm (het jaarstuk gaat over publiceren, de gift over
  aftrekbaarheid), maar het is één status die op twee plekken wordt aangenomen.

- **De ANBI-stand staat los van `foundationregistratie`.** Zodra de beschikking
  er is, hoort het RSIN op de plek te komen waar die laag hem al kent, en niet
  in een tweede veld. Nu staat hij in de giftstand.
