# Edge Quiet Presence — visueel bewijs

De beelden zijn op dezelfde publieke Foundation-route gemaakt met Chromium, een viewport van 390 × 844 pixels en `prefers-reduced-motion: reduce`. De opname vóór de wijziging komt rechtstreeks uit commit `7113f6c`; de opname erna uit deze branch.

| Meting | Voor | Na |
| --- | ---: | ---: |
| Rusttoestand | `peek` | `peek` + `idle` |
| Edge-breedte | 366 px | 88 px |
| Edge-hoogte | 64 px | 48 px |
| Rahul-bediening | 356 × 48 px | 82 × 44 px |

De bestaande toestand `peek` blijft de bron van waarheid. `idle` is alleen de semantische presentatielaag die de rustige vorm activeert.

## Voor

![Edge vóór Quiet Presence](before-mobile.png)

## Na

![Edge na Quiet Presence](after-mobile.png)
