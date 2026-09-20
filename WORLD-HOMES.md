# LivingOS, TravelOS, WorkOS en FoundationOS homes

De op 19 september 2026 getekende en daarna goedgekeurde homes zijn opgebouwd
binnen de bestaande routes. Dit document beschrijft de implementatie en haar
bewijsgrenzen; het is geen productie-vrijgave.

## Gedrag

- `/apps/wereld.html` is de LivingOS Home. De op 20 september goedgekeurde
  tekening is vertaald naar vier fotografische ingangen, de zichtbare kop
  'Het leven, met elkaar.', een grote fotokaart en de ontdekkaart. De bestaande
  profiel-, filter-, zoek-, paginering- en gespreksfuncties blijven behouden.
  Camera, Food Court, Table en TravelOS zijn echte bestaande bestemmingen.
  Een gast of lege feed krijgt expliciet een **Voorbeeldmoment**. De drie
  pictogrammen leggen waarderen, reageren en bewaren uit; ze schrijven niets
  en verwijzen naar De Salon voor echte berichten. Echte feedberichten houden
  hun bron, auteur, inhoud, aantallen en bronacties. Een onbereikbare feed toont
  een fout met herstelactie, nooit het voorbeeld van een leeg account.
- `/apps/reizen.html` toont de redactionele reisopening, bestaande reisfuncties
  en de eerste reis uit `/api/reis/reizen`. De fotografie heet expliciet
  sfeerbeeld. Een leeg account krijgt geen voorbeeldbestemming of boeking.
  De reiswacht en zijn ontbrekende bronnen blijven zichtbaar. Reisstatus,
  boekingsinvoer en de volledige catalogus zijn uitklapbaar; de invoer blijft
  lezen, nakijken en daarna bewust bevestigen. `#invoer` opent zijn onderdeel.
- `/apps/kantoor.html` is de WorkOS Home-bestemming in de centrale routekaart.
  De eigen afspraken en werkzaamheden blijven uit `/api/kantoor/wereld`
  komen. De tijdlijn en specialistlinks blijven leidend. Geen gefingeerde
  vergaderingen, projectvoortgang of teamleden. Expliciete doelgroep-links
  openen het bijbehorende onderdeel.
- `/apps/foundation/index.html` toont dezelfde nieuwe fotografie voor gasten
  en gezinsprofielen. Leren, talent en ondersteuning openen de bestaande
  apps. FoundationOS is en blijft 100% gratis. De huidige gezinsrechten,
  profielkeuze en onboarding veranderen niet. Een mislukte agenda-aanvraag
  wordt niet meer als een lege agenda getoond.

De standaard Edge bezit de bediening. Foundation projecteert zijn bestaande
knoppen in die Edge; de oorspronkelijke handlers en rechten blijven eigenaar.
Er is geen nieuwe toolbar, gegevensopslag, schrijfroute of AI-aanroep toegevoegd.

## Presentatie en taal

`rtg-world-home.css`, `rtg-world-home-copy.js` en `rtg-world-home.js` verzorgen
alleen presentatie. De domeinpagina's houden hun requests en gegevens. De
centrale Heritage-laag blijft het laatste stylesheet. De goedgekeurde
fotokaarten gebruiken de nieuwe centrale hoekrol uit ONTWERP.md.
LivingOS sluit hierop aan via `wereld-feed.css`, `wereld-feed.js` en het
afzonderlijke voorbeeld in `wereld-welcome.js`. De kop en profielingang zijn
de bestaande gedeelde Edge, met de presentatie van de goedgekeurde tekening.

De nieuwe vaste teksten hebben NL/EN-sleutels. Andere talen gebruiken de
bestaande vertaalcache en vertaalroute; dit werk certificeert geen nieuwe
semantische dekking voor alle 114 talen. De browserproef schakelt zonder AI
NL/EN en Arabisch/RTL en controleert dat formulieren en brongegevens behouden
blijven. Bronuitval blijft zichtbaar. Bediening verandert geen intent of recht.
De nieuwe assets zitten ook in de bestaande serviceworker-schil.

## Gemeten op 20 september 2026

- `test/world-homes.e2e.js`: 320/390/1440 px, enkele Edge, scrollbereik,
  Bodoni-typografie, vaste gratisbelofte, NL/EN/RTL, ingevulde formulieren,
  echte bevestigde reis en agenda-afspraken, Work Home-navigatie,
  Foundation-profielacties en expliciete uitval van de drie gegevensbronnen.
- Bestaande invoerbalie, reiswacht, reizenscherm, kantoor en adaptive Edge:
  de bestaande functieproeven blijven slagen. De invoerproef opent het
  onderdeel eerst via de zichtbare samenvatting.
- Foundation-voorzijde, Work-doelgroepen en Heritage-contracten: 27 unitproeven.
- Visueel bekeken: alle drie de homes op 390 en 1440 px. In de zes bezoeken
  geen scriptfouten of horizontale overflow; de bestaande lokale a11y-meter
  rapporteerde geen overtredingen. Dat is geen volledige toegankelijkheidsaudit.
- Tijdelijke mutatie: een verzonnen Ibiza-reis bij een leeg account laat de
  reisproef zakken op `no invented destination`.
- Tijdelijke mutatie: Work Home terugzetten naar de werkruimte laat de
  navigatieproef zakken bij de verwachte Home-route. Beide bronnen hersteld.

De test- en beeldartefacten staan in de ontwerpwerkruimte onder
`output/world-homes-concepts-20260919/implementation`. Geen productie-account
of externe boeking is voor deze lokale proeven gebruikt.

## LivingOS: aanvullend gemeten op 20 september 2026

- `test/wereldlaag.e2e.js`: 320/390/1440 px, één Edge, echte bestemmingen,
  herkenbaar voorbeeld zonder berichtenmutaties, NL/EN en Arabisch/RTL,
  behoud van de geopende uitleg, bronuitval en opnieuw laden. De bestaande
  proef behoudt echte Salon-foto's, gespreksoverdracht, serverrechten,
  profielzichtbaarheid, zoeken, filters en de ingesloten weergave.
- Samen met wereldbreedte, Adaptive Edge en Heritage: 13 gerichte proeven
  geslaagd, geen overgeslagen proeven.
- Visueel bekeken op 320/390/1440 px, plus NL/EN/RTL. Geen scriptfouten,
  horizontale overflow of overtredingen bij de bestaande lokale a11y-meter.
  Dit is geen volledige toegankelijkheidsaudit of bewijs van 114 vertalingen.
- Tijdelijke mutatie: het foutpad in `wereld-welcome.js` uitschakelen maakt
  bronuitval tot een voorbeeld. De nieuwe browserproef zakt dan op het
  ontbrekende `.living-load-error`. De bron is daarna hersteld.
- Artefacten: `output/world-homes-concepts-20260920/implementation` in de
  ontwerpwerkruimte. Dit is een lokale implementatiecontrole, geen uitrol.

De build, `npm run check`, `npm run norm` en `npm run registerklopt` zijn voor
LivingOS geslaagd. Na herstel van de mutatie zijn de twee LivingOS-proeven
opnieuw geslaagd, samen met de vier proeven voor TravelOS, WorkOS en
FoundationOS (17 verschillende gerichte proeven over beide rondes). De
volledige lokale CI is in deze LivingOS-ronde niet uitgevoerd.

Voor de drie eerder opgeleverde homes is de volledige GitHub CI van PR #321
(run 35499691243) geslaagd. Die uitkomst geldt voor die commit; de nieuwe
LivingOS-wijziging krijgt haar eigen PR-controles. Dit document verleent geen
productie-vrijgave en registreert geen uitrol.
