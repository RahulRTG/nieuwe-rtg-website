# Twee websites, één visuele familie

`app.rahultravelgroup.com` legt het product uit: de vier werelden, hun samenhang,
Rahul, menselijke regie, privacy, passen, vragen en de bestaande aanmeldroute.
De publieke Experience-homepage blijft de inhoudelijke basis. De nieuwe
presentatie gebruikt dezelfde fotografie, typografie en materialen als de
desktopwidgets.

`www.rahultravelgroup.com` is de afzonderlijke bedrijfssite op Cloudflare Pages:
oorsprong, visie, technologie, verantwoordelijkheid en kansen. De bedrijfssite
is niet dezelfde deployment of bron als dit repository. De nieuwe lokale
bedrijfspresentatie bevat vier verhaalhoofdstukken, geen kopie van de
productdemonstratie. Het bestaande Pages-project en de canonieke bron moeten
nog via de ingelogde Cloudflare-omgeving worden vastgesteld.

## Productpresentatie in dit repository

- `index.html` blijft de canonieke Experience-home, zowel via de Node-landing
  als via een statische projectroute.
- `public/site/storyline-stage.js` presenteert `RTGExperienceCore`. Scenario's,
  keuzes en gevolgen worden niet opnieuw in een tweede model opgeslagen.
- De vier openbare wereldpagina's gebruiken hetzelfde model en dezelfde
  presentatie. Een gewijzigde vertrektijd, maaltijd, bezetting of schooltijd
  verandert het voorstel. Een uitgeschakelde voorbeeldagenda blijft onbekend.
- De widgetachtige onderdelen zijn uitklapbare verklaringen bij een
  demonstratie. Ze lezen geen ledengegevens en verrichten geen boekingen,
  betalingen, berichten of andere persoonlijke handelingen.
- De negen wereld- en paspagina's gebruiken de bestaande Adaptive Edge.
  De bediening blijft beschikbaar tijdens het lezen. FoundationOS is en
  blijft altijd 100% gratis.
- De bestaande taalvoorziening vertaalt de presentatie. De betekenis blijft
  in taalneutrale scenario-, optie- en toestemmingssleutels staan.

## Aangetoond en grenzen

De bestaande Experience-toetsen controleren de daadwerkelijke aanmeldhandoff,
de statische projectroute, gebruik zonder JavaScript en drie schermbreedtes.
De schermranden-toets bezoekt alle tien openbare routes op vijf breedtes.
`test/storyline-worlds.e2e.js` verandert alle vier scenario's, controleert de
gevolgen, reset via de Edge, behoud van een geopend onderdeel, taalwissel,
RTL en breedtes 320, 390, 834 en 1440 pixels. Hij controleert ook dat de
demonstratie geen persoonlijke wijzigingen verstuurt.

Een afzonderlijke browsermutatie keerde het vertrekconflict om: vrijdagavond
werd ten onrechte als conflict behandeld. Dezelfde gevolgcontrole slaagde
op de oorspronkelijke respons en zakte op de gemuteerde respons. Alleen de
browserrespons werd aangepast; bronbestanden en het mutatieregister bleven
ongewijzigd.

De gerichte desktopintegratieronde heeft 33 geslaagde toetsen. De taalproef
heeft 27 geslaagde toetsen; `productionReady114` blijft uitdrukkelijk `false`.
Deze metingen zijn geen bewijs van 114 volledig gecertificeerde talen,
werkelijke boekingen of een gecontroleerde productie-uitrol. De volledige
CI-keten en de afzonderlijke Cloudflare-publicatie hebben hun eigen poorten.
