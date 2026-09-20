# TravelOS, WorkOS en FoundationOS homes

De op 19 september 2026 getekende en daarna goedgekeurde homes zijn opgebouwd
binnen de bestaande routes. Dit document beschrijft de implementatie en haar
bewijsgrenzen; het is geen productie-vrijgave.

## Gedrag

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

De build, `npm run check` en de afzonderlijke `npm run norm` zijn geslaagd.
De volledige lokale CI is wel gestart, maar niet geslaagd: `evidence:record`
maakte BEWIJSBOEK.json aan, waardoor `metingenZonderRatel` op 51 kwam bij
een norm van 50. De daaropvolgende metingen markeerden daarnaast de nog
niet vastgelegde werkboom (`registersUitVuileBoom`: 2 bij norm 1). De brede
230-bestanden-schermronde is daarna gestopt; de hierboven genoemde gerichte
proeven zijn wel volledig uitgevoerd. Lokale meetartefacten zijn apart bewaard,
de registerbronnen zijn hersteld en geen norm is verlaagd. De GitHub-keten
moet op de vastgelegde commit nog haar eigen oordeel geven.
