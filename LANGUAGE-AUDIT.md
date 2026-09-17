# Taalcontrole van RTG

Controle van 17 september 2026, bij PR 301. De codebrede inventarisatie gebruikt de bestaande `scripts/tekstoppervlak.js`-meter: 320 HTML-bestanden, 577 clientbestanden en 3.561 serverbestanden. Gebundelde code wordt één keer geteld. Dit is een statische inventarisatie, geen bewering dat ieder scherm handmatig in 114 talen is beoordeeld. De instrumentgrenzen staan in die meter en in LANGUAGE.md.

## Gevonden en hersteld

- De aanmeldroute kende hoofdzakelijk Nederlands/Engels en dynamische teksten volgden de taalwissel niet. De route gebruikt nu gedeelde sleutels; invoer, focus, wachtwoordzichtbaarheid en voortgang blijven behouden, ook wanneer vertalingen later arriveren.
- Het paginawoordenboek stopte na 400 sleutels. De gedeelde loader haalt alle in aanmerking komende sleutels in begrensde batches op en gebruikt de bestaande cache eerst. Onveranderde brontekst telt niet als geslaagde vertaling.
- De Edge Bar en haar menu's gebruikten eigen Nederlandse teksten. Die gedeelde bediening heeft nu codebeheerste Engelse bronkopij voor de navigatie, menugezichten, context, toegankelijkheidslabels, voorkeuren, status en gemeenschappelijke wereldfuncties. Deze werkt ook zonder een modelserver. Andere talen gebruiken de bestaande vertaalcache en vertaaldienst; waar die ontbreken blijft de Engelse basis herkenbaar beschikbaar.
- De menuzoekfunctie zocht uitsluitend in Nederlandse `data-search`-tekst. Zij zoekt nu ook in de zichtbare vertaalde labeltekst. De ingevoerde zoekterm en het open menu blijven bij een taalwissel staan.
- Bediening en meerdere opmaakregels werden gevonden via de Nederlandse waarde van `aria-label`. De gedeelde Edge-projectie en opmaak gebruiken daarvoor nu de bestaande structurele navigatieklasse. Vertaalde tekst bepaalt niet welke bediening wordt aangesloten.
- Lokale menuknoppen namen volgnummers en pijlen uit de bronlink over als onderdeel van het label. Zij nemen nu de eigenlijke labeltekst over. De werkbladenknop gebruikt dezelfde icoon/tekststructuur als de andere menu-items, zodat vertaalde woorden niet in de icoonkolom worden geperst.
- Verbindingsmeldingen volgen de taalwissel en blijven boven de gedeelde Edge Bar staan, zodat langere vertalingen de navigatie niet bedekken.
- De toegangspagina verbergt de bovenrand. De bestaande taalkiezer heeft daarom ook een ingang in het standaard Edge-menu onder Heel RTG. De browserproef kiest Engels via deze zichtbare route.
- Bedragen, agenda's, meldingen en datums in de ledenapp kozen vaak Nederlands voor iedere taal behalve Engels. De formattering gebruikt nu de gekozen locale. Opslagwaarden, datums in API-verzoeken en numerieke berekeningen veranderen niet.
- Kritieke accounttekst kon afhankelijk worden van modeluitvoer. De betekenisadapter houdt acht vaste handelingen en getypeerde parameters aan. Juridisch akkoord is gebonden aan de actuele contractversie; een wijziging vereist opnieuw expliciet akkoord.

## Wat nog openstaat

De eerste inventarisatie vond 307 vaste Nederlandse locale-aanroepen over client en server. Een deel is presentatie, een deel is normalisatie of vaste documentinhoud. Alleen de beoordeelde presentatieformatters in de ledenapp zijn in deze wijziging omgezet. Het blind vervangen van locale-normalisatie kan juist identifiers, sortering of betekenis veranderen en is daarom geen geldige migratie.

De meter vindt ruim 26.000 unieke tekstfragmenten, inclusief inhoud, lesmateriaal en technische documentatie. Dat getal is geen aantal ontbrekende vertalingen. Niet alle dynamische serverfouten, lange teksten, domeinmenu's, mailberichten, documenten en spraakpaden hebben een gevalideerde berichtencatalogus. Bestaande domeinschermen kunnen daardoor nog bron- of terugvaltekst tonen. Deze punten zijn niet als opgelost afgevinkt.

Alle 114 talen zijn technisch selecteerbaar; volledige vertaal- en betekenispariteit voor alle RTG-oppervlakken is niet bewezen. `LANGUAGECAPABILITY.json`, `MEANINGPARITY.json` en `LANGUAGEFAILOVER.json` houden die grens expliciet. Ze mogen niet worden aangehaald als certificering van alle marketing-, betaal-, mandaat- of juridische teksten.

## Gecontroleerd gedrag

De reproduceerbare taalproef doorloopt de werkelijke browser en accountserver, alle 114 selecties, RTL, Unicode-invoer, behoud van toestand, Edge-labels, menuzoeken en een contractwijziging tijdens de aanmelding. Een aparte foutproef stopt een geïsoleerde lokale modeladapter. De bestaande project-, aanmeld-, Edge- en toegankelijkheidscontroles blijven daarnaast van toepassing.

De aparte medewerkersingang `/apps/personeel.html` had nog de oude klokpoort en begon bij iedere taalwissel opnieuw. Deze gebruikt nu hetzelfde toegangscanvas. De browserproef `test/pda-ui.e2e.js` controleert de eigen login, bedrijfsaanmelding, herstel, apparaat- en kantoorroute op 320, 390 en 1440 pixels, met behoud van invoer bij Nederlands/Engels en bediening via de gedeelde Edge. De proef voert een echte testlogin, werkgeversuitnodiging en herstelaanvraag uit tegen een geïsoleerde server; zij bewijst geen fysieke e-mailbezorging of vertaalpariteit voor de overige talen.
De bestaande Team Room-navigatie is tevens aangemeld bij de gedeelde Edge-projectie. De personeelstests bedienen deze via Acties; zij klikken niet langer op de oude balk achter de Edge.
