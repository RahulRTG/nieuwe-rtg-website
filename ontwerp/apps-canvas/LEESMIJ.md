# RTG Muziek · Sociaal · Zorg — ontwerpcanvas

Zeven telefoonschermen (390 × 844) over drie apps, in één vormtaal: warm
bijna-zwart voor Muziek en Sociaal, ivoor voor Zorg. Bodoni voor de emotie,
Inter voor de bediening, gouden kapitalen als eyebrow, bordeaux als één gevuld
vlak per scherm.

## Bouwen

```
node _bouw.mjs          # zet _stijl.css in elk deel -> *.dc.html
```

Wie een `.dc.html` met de hand wijzigt, raakt die wijziging kwijt bij de
volgende bouw. De bron is `delen/*.part.html`.

## De schermen

| Pagina | Artboard | Bestaand scherm |
|---|---|---|
| Muziek | Home, Speler | `/apps/muziek.html` |
| Sociaal | Feed, Kringen | `/apps/sociaal.html`, `/apps/cercle.html`, `/apps/entourage.html` |
| Zorg | Home, Agenda, Zorgmoment | `/apps/app.html` (stand zorg) |

## Drie afwijkingen van de referentiebeelden, met reden

1. **Zorg draagt donker goud** (`#745718` / `#B89545`) in plaats van
   champagnegoud. Champagne haalt op ivoor de contrastnorm niet; dit is dezelfde
   regel die `ONTWERP.md` par. 4a voor LivingOS al vastlegt.
2. **Story-ringen zijn goud**, niet roze-oranje. Dat verloop is het handelsmerk
   van een ander platform.
3. **Geen nagetekende iOS-statusbalk.** De ruimte is gereserveerd; op een echt
   toestel tekent de telefoon daar zijn eigen balk overheen.

## Wat dit kost als het in `public/` landt

De ronding staat op elk artboard op een schuif (0–22px). Op `0` staat de
huisregel uit `CLAUDE.md` (`border-radius:0`, alleen een cirkel mag, bewaakt
door `scripts/check.js` regel 51). Deze schermen staan op 16/12px, en de pillen
op `999px`. Landt dat in `public/`, dan moet die regel mee veranderen.

Hetzelfde geldt voor de gevulde bordeaux knop: `ONTWERP.md` (*Rust is de
luxeregel*) zegt "geen grote massieve rode knoppen". Hier staat er één per
scherm, nooit twee.
