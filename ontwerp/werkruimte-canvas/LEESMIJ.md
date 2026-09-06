# RTG Spatial Workspace — ontwerpcanvas

Zes artboards die `WERKRUIMTE.md` visueel maken, in de vormtaal van de
referentiebeelden van de eigenaar (warm bijna-zwart, Bodoni voor de emotie,
Inter voor de bediening, gouden kapitalenlabels, ronde hoeken).

## Bouwen

```
node _bouw.mjs          # zet _stijl.css in elk deel -> *.dc.html
```

De artboards moeten zelfstandige bestanden zijn, dus de gedeelde stijl wordt
INGEZET en niet ingelezen. Hij staat op één plek zodat zes artboards niet uit
elkaar lopen; wie een `.dc.html` met de hand wijzigt, raakt die wijziging kwijt
bij de volgende bouw.

## Wat er waar staat

| Artboard | Toont | Klikbaar |
|---|---|---|
| `Main` | shell met de centrale console, één surface | nee |
| `Grens` | vier vakken bezet, de vijfde verdringt de oudste | nee |
| `Greep` | de gouden greep op ware grootte, met de maten | nee |
| `Zoom` | Glance · Work · Deep | ja |
| `Context` | Context Linking — één verwijzing, vijf apps | ja |
| `Slepen` | het sleepprotocol met de bevestigingsstap | ja |

Maten, kleuren en gedrag komen uit `public/shared/rtg-schil.css` en
`public/shared/rtg-schil/*.js` — overgenomen, niet benaderd.

## Twee dingen die een besluit vragen

1. **Vier of vijf surfaces.** `WERKRUIMTE.md` §8 belooft 5–6 op ultrawide en §9
   heet "Rustig blijven met vijf apps open". `rtg-schil/03-surfaces.js` zegt
   *"Vier is een systeemgrens, geen aanbeveling"* en laat de vijfde app de
   oudste niet-actieve vervangen — in de modus `standaard`, en
   `public/apps/werkruimte.html` draait precies die modus. Het artboard tekent
   wat de code doet.

2. **De ronding.** Elk artboard heeft een schuif `ronding` (0–18px). Op `0`
   staat de huisregel uit `CLAUDE.md` (`border-radius:0`, alleen een cirkel mag,
   bewaakt door `scripts/check.js` regel 51); hoger staat de pilstijl uit de
   referentiebeelden. Landt die stijl in `public/`, dan moet die regel mee
   veranderen — anders zakt `npm run check`.
