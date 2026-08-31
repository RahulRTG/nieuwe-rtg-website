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

| optie | wat het betekent | prijs |
|---|---|---|
| **A. Een RTF-positie in RTG Pay** | De stichting krijgt een eigen positie in de waardelaag; een gift is een boeking van lid naar entiteit. | Blijft binnen het gesloten circuit, dus geen nieuwe vergunningvraag. Maar: het geld staat dan bij RTG en moet er ook weer uit naar de bankrekening van de stichting — dat is de uitgang uit `TOKEN.md`, en die staat nog open. |
| **B. Rechtstreeks naar de bankrekening** | RTG zet de gift klaar; de betaling gaat via de betaalnaad naar de stichting. | Schoonste scheiding: RTG raakt het geld niet aan. Vraagt wel een echte betaalaanbieder op naam van de stichting, en dan is RTG betaaldienstverlener voor een derde — een eigen vraag. |
| **C. Allebei, met een schakelaar** | Klein bedrag via Pay, groot via de bank. | Twee wegen betekent twee keer verantwoorden, en `WAARDE.md` waarschuwt precies daarvoor: er komt geen tweede boekhouding bij. Ik raad het af. |

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

- **Ja** → het RSIN en de ANBI-status horen zichtbaar op de pagina, en het
  giftbewijs mag zo heten. Ze worden dan één keer vastgelegd op de plek waar de
  registratielaag ze al kent, en `bewijsbaar()` leest ze — niet een tweede
  veld ernaast, want twee plekken die hetzelfde bedoelen lopen uiteen.
- **Nee, of nog niet** → het stuk heet geen giftbewijs maar een
  *ontvangstbevestiging*, en het scherm zegt erbij dat de gift niet aftrekbaar
  is. Dat is geen kleine lettertjes-kwestie: het verschil zit in wat de gever
  bij zijn aangifte mag invullen.

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

## 6. Wat ik nodig heb om te bouwen

Drie antwoorden, meer niet:

1. **Entiteit** — optie A, B of C uit besluit 1.
2. **Vorm** — welke van de drie giftvormen opengaan (en in welke volgorde).
3. **ANBI** — is de RTFoundation er zelf een, en zo ja: het RSIN. Bij nee heet
   het stuk een ontvangstbevestiging en zegt het scherm dat de gift niet
   aftrekbaar is.

Met die drie is het bouwwerk overzichtelijk: één module naast `donateur.js` die
een voorgenomen gift klaarzet, één schakelaar in de boardroom, één scherm, en de
toetsen die de zeven grendels hierboven vasthouden. De verantwoording erna
bestaat al.
