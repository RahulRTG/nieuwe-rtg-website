# RTG World Maps

TravelOS heeft twee kaartniveaus die bewust van elkaar zijn gescheiden:

1. **RTG World Atlas** — een lichte, ingebouwde wereldkaart met 177 landen en
   243 wereldsteden. Deze laag is altijd beschikbaar, ook wanneer er nog geen
   routepakket voor een regio op de server staat.
2. **RTG World Graph** — lokale routegrafen uit OpenStreetMap-PBF. Samen kunnen
   land- en continentpakketten de hele planeet afdekken. TravelOS berekent de
   route zelf en verstuurt geen positie naar een kaart- of routedienst.

Nederland blijft de dagelijkse Rijkswaterstaat/NWB-graaf gebruiken. Dat is de
autoritatieve premiumlaag; een geïnstalleerd Europees OSM-pakket neemt routes
binnen Nederland niet over. Grensoverschrijdende ritten kunnen wel via het
Europese World Graph-pakket lopen.

## Bronnen en licenties

- Wereldatlas: Natural Earth 1:110m, publiek domein.
- Straten, plaatsen en routegrafen: OpenStreetMap, ODbL 1.0.
- Nederland: Rijkswaterstaat NWB, CC0 1.0.

Een interactieve kaart met OSM-data moet zichtbaar naar OpenStreetMap en de
ODbL verwijzen. De bron en bouwdatum worden daarom ook in ieder regiopakket en
in de navigatiestatus opgeslagen.

## Atlas vernieuwen

```bash
npm run navigatie:atlas
```

De generator haalt de officiële Natural Earth-GeoJSON op en schrijft het
compacte bestand naar `public/data/wereld-atlas.json`.

## Een routepakket bouwen

Gebruik een standaard `.osm.pbf`-extract. De importer heeft geen osmium,
GDAL, PostGIS of externe Node-dependency nodig; de PBF- en protobuflezers zijn
onderdeel van RTG.

```bash
npm run navigatie:wereld -- \
  --bron /data/europe-latest.osm.pbf \
  --regio europa \
  --naam Europa
```

Een landpakket werkt hetzelfde:

```bash
npm run navigatie:wereld -- \
  --bron /data/japan-latest.osm.pbf \
  --regio japan \
  --naam Japan
```

De uitvoer komt standaard in:

```text
server/data/navigatie/wereld/
  manifest.json
  europa.sqlite
  europa-graaf/
    graaf.json
    coords.f64
    offsets.u32
    doelen.u32
    kosten.f32
    lengtes.f32
    wegen.u32
    vlaggen.u8
```

`server/data/` is genegeerd door Git. Productie bewaart deze data op een apart
volume en vervangt een regiopakket atomair na een geslaagde bouw.

## Productie-indeling

Gebruik bij voorkeur zes tot acht overlappende continentpakketten. Daarmee
blijven updates, cold starts en terugrolacties beheersbaar. Een wereldwijd PBF
kan door dezelfde importer, maar één monolithische graaf vergroot de blast
radius en de herbouwtijd zonder voordeel voor een routeverzoek.

De runtime opent voor zoeken alleen de regionale SQLite-index. De veel grotere
binaire adjacency arrays worden pas geopend wanneer een route of lokale kaart
die regio werkelijk nodig heeft en blijven daarna read-only in het proces.

## Eerlijke grenzen

- Zonder routepakket kan TravelOS het gebied wel tonen en op landen/steden
  zoeken, maar het verzint geen route.
- Maximumsnelheden worden gebruikt wanneer OSM ze levert; anders geldt een
  controleerbare terugvalsnelheid per wegtype.
- Realtime verkeer, afsluitingen en partneroperaties zijn aparte, vervallende
  signalen boven op de statische routegraaf.
- Satellietbeelden en wereldwijde straatbeelden vallen niet onder deze open
  datasets en vereisen een afzonderlijke licentie of eigen opnameprogramma.
