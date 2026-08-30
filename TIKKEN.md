# Hoeveel tikken staat een functie van het beginscherm af

Gemeten, niet geschat. `scripts/tikken.js` loopt het huis af vanaf het
beginscherm (`/apps/app.html`, WERELD.md) in een echte browser, op
telefoonformaat, met een gewone ledensessie, en vraagt per scherm hoeveel
tikken het kost. `TIKKEN.json` is de uitslag; dit document zegt wat hij
betekent.

## De belofte

> **Elke functie van een lid ligt binnen vijf tikken van het beginscherm, en
> elk scherm dat er niet ligt, draagt een uitgeschreven reden.**

Dat tweede deel is de helft van de belofte. Een meldkamer, het loonkantoor of
de PDA van een hardwarelab hoort niet op het beginscherm van een lid te staan;
wie daar werkt komt er via zijn zaak. Zou de belofte "alle 276 schermen" zijn,
dan dwong hij het huis om deuren te tekenen die de meeste leden niet mogen
opendoen. De lijst met redenen staat in `scripts/tikken.js` (`MET_REDEN`), per
scherm, in drie soorten: **ROL** (een scherm van een rol), **LANDING** (je landt
er via een code of een link, zie `scripts/lib/bereik.js`) en **STAND** (een adres
dat een stand van een andere app is geworden).

`node scripts/tikken.js --controle` zakt zodra er een scherm onbereikbaar is
dat géén reden draagt. Een reden die verlopen is -- het scherm blijkt alsnog
bereikbaar -- wordt gemeld maar laat de controle niet zakken: dat is goed
nieuws, alleen mag de regel dan weg.

## Wat een tik is

- een zichtbare link of knop met een bestemming aantikken: **1 tik**;
- een bestemming die er staat maar niet zichtbaar is (achter een tabblad, een
  lade, een dichtgeklapt paneel): **2** -- eerst openmaken, dan aantikken;
- **typen is geen tik.** Wie in een lijst drie letters typt, heeft een veld en
  een resultaat aangetikt.

## Wat de meter niet ziet

Een knop die met JavaScript ergens heen springt zonder `href` of `data-url`
bestaat niet voor deze meter. De uitkomst is daarmee een **bovengrens**: het kan
in werkelijkheid korter zijn. Dat is met opzet zo gelaten, want het maakt de
meter oneerlijk in de veilige richting -- hij is niet op te poetsen met een
belofte. Wie een korte weg bouwt, hangt het adres op de knop; dan telt hij mee.

En hij meet de weg **naar** een scherm, niet de weg naar een handeling binnen dat
scherm. Dat laatste staat in `test/*.e2e.js`.

## De eerste meting, 30 augustus 2026

| tikken | schermen |
|---|---|
| 0 (het beginscherm zelf) | 1 |
| 2 | 4 |
| 3 | 119 |
| 4 | 76 |
| 5 | 24 |
| buiten bereik | 52 |

Tweeënvijftig schermen waren vanaf het beginscherm **helemaal niet** te
bereiken -- niet diep, maar los. Daaronder gewone ledenschermen: RTG Mall, RTG
Pay, Thuis, Uitgaan, de Food Court, Game Night, het tweede scherm, Mijn
bestellingen, het app-dossier (dat volgens APPSTORE.md juist bij het lid hoort),
Aankomst, het routedossier, OV-routes, en het bord en het schrift van de
RTFoundation. Twee schermen stonden zelfs wél in `MAPPEN` en waren tóch
onbereikbaar (Passkeys, de wereldlaag): de huizen van de werelden dragen een
handgeschreven rooster dat uit elkaar was gelopen met de lijst waar het uit
hoort te komen.

## Wat eraan gedaan is

1. **De sprong** (`public/shared/sprong.js`): één greep die op elk scherm op
   dezelfde plek staat, met daarachter alles wat u kunt openen. Eén tik naar de
   lijst, één tik naar de functie -- twee tikken, waar u ook staat. De lijst komt
   uit `public/shared/sprongindex.json`, en die wordt **afgeleid** uit `MAPPEN`
   door `scripts/sprongindex.js`; er komt dus geen tweede lijst bij (LAT.md
   regel 4). Op `/apps/app.html` opent dezelfde greep de bestaande zoeklade van
   de leden-app, want die weet meer (uw pas, en Rahul) -- twee spotlights naast
   elkaar zou precies de fout van het tweede bank-kopje herhalen.
2. **De veertien dakloze ledenschermen** hangen nu in de wereld waar de mens
   denkt te zijn als hij ze gebruikt (`WERELDEN.md`), en staan daarmee ook in de
   sprongindex.
3. **De rijen dragen hun adres** -- in de sprong én in de zoeklade van de
   leden-app -- zodat de korte weg meetbaar is en niet stilletjes kan verdwijnen.

## De stand na die ingreep

| tikken | schermen |
|---|---|
| 0 | 1 |
| 2 | 64 |
| 3 | 102 |
| 4 | 69 |
| 5 | 6 |
| met reden buiten bereik | 34 |

Vierenzestig schermen op twee tikken (was vier), zes op vijf (was
vierentwintig), en van de tweeënvijftig losse schermen zijn er nog
vierendertig -- allemaal met een uitgeschreven reden.

## Wat hier niet staat, en eerlijk gezegd moet worden

Dit is gemeten met een browser en niet met een mens. Vijf tikken die je moet
zóéken zijn erger dan zeven die vanzelf gaan; deze meter kent dat verschil niet.
Hij is een ondergrens voor de vraag "is het te bereiken", geen oordeel over de
vraag "is het te vinden". Diezelfde grens staat als laatste zin in
`TOEGANKELIJK.md`, en om dezelfde reden.
