# Nederlands wegennet in RTG Navigatie

RTG Navigatie gebruikt voor Nederland het **Nationaal Wegenbestand (NWB)** van
Rijkswaterstaat. De dataset is landsdekkend, publiek domein onder CC0 1.0 en
bevat de topologische begin- en eindjunctie van ieder wegvak. Een routeverzoek
gaat nooit naar Rijkswaterstaat of een commerciële kaartdienst: de dagelijkse
bron wordt vooraf omgezet naar een lokale RTG-routegraaf.

Bronnen:

- Dataset: <https://data.overheid.nl/dataset/79841-nwb-wegen---dagelijks>
- Dagelijkse GeoPackage: <https://downloads.rijkswaterstaatdata.nl/nwb-wegen/geogegevens/geopackage/NWB-dagelijks/Wegvakken/Wegvakken.gpkg>
- Productspecificatie: <https://docs.ndw.nu/handleidingen/nwb/nwb-producten/nwb-wegen/>
- Licentie: CC0 1.0

## Inladen en verversen

```sh
npm run navigatie:nederland
```

Het script downloadt de actuele GeoPackage, leest de GeoPackage-WKB zonder
externe GIS-module, zet Rijksdriehoekscoordinaten om naar WGS84 en bouwt:

- `RTG_DATA_DIR/navigatie/nederland.sqlite`: straat-, plaats-, geometrie- en
  ruimtelijke index;
- `RTG_DATA_DIR/navigatie/nederland-graaf/`: de compacte binaire adjacencylaag
  waarmee A* tijdens een route geen miljoenen databasevragen hoeft te doen.

Beide paden zijn runtime-data en vallen onder de bestaande `server/data/`
Git-uitsluiting. Een bestaande lokale GeoPackage kan zonder download worden
gebruikt:

```sh
npm run navigatie:nederland -- --bron /pad/naar/Wegvakken.gpkg
```

Alleen de binaire versneller opnieuw maken:

```sh
npm run navigatie:nederland -- --alleen-graaf
```

## Routebesluit

NWB levert wegcategorie, rijrichting, straatnaam, wegnummer, functieklasse en
topologie. RTG vertaalt die deterministisch naar toegang en basistijd:

- auto en EV gebruiken de berijdbare wegvakken en respecteren H/T/B-richting;
- fiets gebruikt gewone wegen plus fietspaden;
- lopen gebruikt gewone wegen, fiets- en voetpaden;
- de NWB Functionele Wegklasse bepaalt de veilige terugvalsnelheid;
- RTG-profielen, live meldingen en partnersignalen blijven boven die basis in
  de eigen uitlegbare intelligence-laag.

De bron bevat geen gegarandeerde actuele maximumsnelheid of turn restrictions.
De FRC-snelheid is daarom een eerlijke schatting, geen juridisch snelheidsadvies.
Actuele afsluitingen en beperkingen horen als RTG/partner-event in de live laag.
