# De geldlat — durability en idempotentie zijn één paar

Dit document beschrijft het contract voor financiële mutaties, en het bestaat
omdat de ketenronde (`npm run ketenronde`, seed `819226199`) een belofte
weerlegde die niemand had opgeschreven: een oplading wordt met 200 bevestigd,
en na een herstart is het geld weg.

`TOEZICHT.md` gaat over hoe bewijs wordt vastgelegd, dit document over de
zwaarste keten die dat bewijs moet leveren.

## Wat er is weerlegd

```
BUSINESSKETEN: GELD
verraad: schrijf-verloren        seed: 819226199

  client response ..... OK
  ledger invariant .... GELDIG
  state wijziging ..... TERUGGEDRAAID   ← het geld is weg
```

Het antwoord klopt, het grootboek klopt met zichzelf, en de oplading bestaat
niet meer. Dat kan omdat een **verloren schrijfactie het grootboek kloppend
achterlaat**: er is nooit iets geboekt, dus de som blijft nul. De sluitcontrole
bewaakt dat het grootboek intern sluit — niet dat wat bevestigd is ook bestaat.
Twee verschillende beloften, en de eerste leek de tweede te dekken.

Zonder sabotage had niemand dit gezien: alle gewone oplaadtoetsen staan groen.
De definitie van "geslaagd" was zelf te zwak.

## Het contract voor een financiële mutatie

```
mutatie voorbereiden
  → grootboek/invariant controleren
  → duurzame write
  → fsync bevestigd
  → state definitief
  → response 2xx
```

De volgorde is de hele inhoud. Een 2xx die vóór `fsync bevestigd` vertrekt, is
een belofte die de opslag nog niet heeft gedaan.

## `saveDuurzaam()` is met opzet een zware primitive

Dit is de belangrijkste ontwerpregel in dit document, en hij gaat over misbruik
in plaats van over techniek.

`saveDuurzaam()` mag **geen algemene synchrone variant van `save()`** worden.
Zodra hij als "de veilige save" wordt gelezen, gebruikt iemand hem voor
profielen, likes en voorkeuren — en dan is het prestatieprofiel van het hele
platform veranderd zonder dat er ooit een beslissing over is genomen. Dat is
geen hypothetisch risico: het is precies hoe elke goedbedoelde primitive
ontspoort.

Daarom:

- hij is **alleen** voor mutaties waarvoor duurzaamheid vóór bevestiging
  noodzakelijk is;
- de toegestane aanroepplekken staan op een **lijst met een reden per regel**,
  net als `PUBLIEK` in de poortwacht en `MAG` in de klokschuld;
- een aanroep buiten die lijst is een **harde fout in `npm run check`**, niet
  een waarschuwing;
- de naam zegt wat het kost, niet wat het oplost.

## De gemeenste failure, en waarom idempotentie erbij hoort

```
duurzame write gelukt
  → proces sterft
  → response bereikt de klant nooit
  → klant retryt
```

De klant weet niet dat de eerste opdracht is gelukt. RTG moet bij de herhaling
herkennen: **deze financiële opdracht is al duurzaam uitgevoerd.**

Zonder dat los je een lost-write op en bouw je een double-write. Durability en
idempotentie zijn hier dus geen twee taken maar één: een duurzame commit die
niet herkenbaar is bij een retry, is een nieuwe fout in plaats van een
opgeloste.

Dat betekent ook dat de idempotentiesleutel **mee moet in dezelfde duurzame
write** als de boeking. Staat hij ergens anders of later, dan bestaat er een
venster waarin de boeking vast staat en de sleutel niet — precies de toestand
die de retry verkeerd laat aflopen.

## De volgorde van bouwen

1. `saveDuurzaam()` als expliciete primitive. **Niet** stilletjes `save()`
   veranderen.
2. Alleen de kritieke geldcommit eraan hangen.
3. Bewijzen dat een 2xx nooit vóór durability vertrekt.
4. Crash direct ná durability, vóór de response.
5. Retry van dezelfde opdracht → exact één financiële mutatie.
6. De echte Beproeving draaien: niet de gemiddelde doorvoer, maar **p95/p99 en
   het event-loop- en opslageffect vóór en na** naast elkaar.
7. Pas dán `GELDPROVEN 2/2`.

Stap 6 vóór stap 7 is geen formaliteit. Een duurzaamheidsgarantie die de
latentie verdubbelt is een productbeslissing, en die hoort met een gemeten
getal genomen te worden.

## Wat er al ligt

`db.persistentieStand()` (`server/db/index.js`) leest de teller die de
SQLite-opslag buiten het geheugen bijhoudt. Bewezen in
`test/persistentiestand.test.js`: hij loopt op na een echte schrijfactie, staat
**stil** onder `schrijf-verloren` terwijl het geheugen wél verandert, en geeft
`null` — niet `0` — waar niet te tellen valt.

**En wat die eerste poging leerde.** Observeren is niet genoeg. Een versie die
de geldroute liet wachten tot die teller opliep, brak vier geldtoetsen met 503:
de opslag is write-behind, dus op het moment dat de route antwoordt is de
schrijfactie nog niet eens geprobeerd. De teller staat dan terecht stil. Er moet
dus **afgedwongen** worden, niet gewacht — en dat is stap 1 hierboven.

## Hoe het bewijs eruit hoort te zien

Niet één woord PROVEN, maar per bewijssoort waar hij vandaan komt — inclusief
waar een bewijssoort níét van toepassing is:

```
GELD-DURABILITY
  scenario test        PROVEN
  fault injection      PROVEN
  subprocess detector  SELF-TESTED
  source mutation      NOT APPLICABLE
```

De laatste regel is er omdat een subprocestoets buiten het bereik van de
mutatiemotor valt. Dat is geen vergeten toets en het hoort niet te verdwijnen
in een totaal van zeshonderd groene: het bewijs kwam anders tot stand, en dat
is leesbaar.

## Waarom `POST /api/pay/oplaad` op GEZAKT staat terwijl CI groen is

Dat is met opzet en het is de kortste samenvatting van dit hele document:

> de codebase is bouwbaar en de controls werken, maar deze concrete financiële
> belofte is onder sabotage weerlegd.

CI rood houden om een onderzoeksbevinding leert iedereen om rood weg te kijken.
De route groen maken zou liegen. De bevinding staat waar hij hoort: in de
matrixcel van de route zelf.
