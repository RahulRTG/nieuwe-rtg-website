# De GEHEUGEN-motor — een volledig in-memory runtime-engine

De RTG-backend draait de hele werkende staat in het RAM (`db.data`) en bewaart
die duurzaam op schijf. Er waren drie motoren voor dat bewaren: **json** (één
`db.json`), **sqlite** (`store.db`) en **postgres** (gedeelde, duurzame waarheid).
De **GEHEUGEN-motor** (`server/db/geheugen.js`) is de vierde: een in-memory
runtime-engine die op elke as beter is dan de JSON-motor — sneller, veiliger,
zuiniger en privé-by-default.

Aanzetten met één omgevingsvariabele:

```
RTG_STORE=geheugen npm start
```

De rest van de app merkt er niets van: die praat alleen met `db.data` en `save()`.

## Waarom, en wat er beter is

De JSON-motor serialiseert bij **elke** `save()` de **hele** datastore, versleutelt
die (maar alleen als `RTG_ENC_KEY` gezet is) en schrijft alles opnieuw weg. Dat is
`O(alle data)` per mutatie, en boven ~512 MB knapt de ene reuzenstring
("Invalid string length"). De GEHEUGEN-motor lost dat op:

| | JSON-motor | GEHEUGEN-motor |
|---|---|---|
| **Sneller / zuiniger** | herschrijft + versleutelt de héle database per save | bewaart per top-level-collectie een eigen brok; een save herschrijft **alleen de veranderde brokken** (vergelijk op sha-256). Onveranderde brokken kosten geen encryptie, geen schijf en geen fsync. |
| **Schaal** | één string van de hele database → stuk boven ~512 MB | nooit één reuzenstring; per collectie apart → die grens bestaat hier niet |
| **Veiliger** | atomisch + fsync; geknoei valt alleen op mét `RTG_ENC_KEY` | elke brok los versleuteld met **AES-256-GCM** (authenticated: een gekanteld bitje valt altijd op); een manifest met per-brok een sha-256 + generatienummer is het **commit-punt** en wordt als laatste geschreven; een halve save laat de vastgelegde staat nooit half achter, en een onleesbare nieuwste generatie **rolt terug** naar de vorige, volledig consistente generatie |
| **Privacy** | platte tekst op schijf **tenzij** je `RTG_ENC_KEY` zet | **altijd** versleuteld-at-rest, ook zonder config. De sleutel komt uit `RTG_ENC_KEY` als die er is (ops houdt de regie), anders uit een zelf aangemaakte 32-byte sleutel in `RTG_DATA_DIR/geheugen.key` (`0600`, staat in `.gitignore`). Niets komt ooit leesbaar op schijf. |

## Hoe het op schijf staat

In `RTG_DATA_DIR/geheugen/`:

- `k-<hash>.rtgm` — per top-level-collectie één versleuteld blok
  (`magic | iv | tag | ciphertext`, AES-256-GCM). De bestandsnaam is een hash van
  de collectienaam, dus de naam zelf lekt ook niet.
- `manifest.rtgm` — versleuteld: het generatienummer en per brok zijn sha-256.
  Dit is het **commit-punt**: pas als dit geschreven is, geldt de nieuwe generatie.
- `<...>.bak` — van elke zojuist herschreven brok en van het manifest blijft de
  vorige versie als `.bak` staan, precies genoeg om één generatie terug te rollen.

## Herstel na een crash

Bij het laden leest de motor het manifest en verifieert elke brok tegen zijn
sha-256 (het primaire bestand, anders de `.bak`). Lukt de nieuwste generatie niet
volledig — bijvoorbeeld doordat de stroom uitviel tijdens de schrijf van één
brok — dan valt de motor terug op de **vorige** generatie (via `manifest.rtgm.bak`
en de brok-`.bak`'s). Zo krijg je nooit een half of gemengd beeld; hooguit gaat de
allerlaatste generatie mutaties verloren, net als het write-behind-venster bij de
andere motoren. Is er helemaal geen leesbare generatie, dan valt de app terug op de
dagbackup (`RTG_DATA_DIR/backups`) of start met verse seed-data.

## Eerlijk: waar het ophoudt

- De `.bak`-brokken dekken de **laatste** generatie (het realistische crash-venster
  bij een schrijf). Bit-rot op een collectie die al generaties niet is aangeraakt,
  valt wél op (de GCM-tag klopt niet) maar heeft geen eigen `.bak`; daarvoor is de
  bestaande **dagbackup** het vangnet.
- De motor is voor één node (net als json/sqlite). Meerdere app-instances die één
  gedeelde, duurzame waarheid delen: dat blijft **Postgres**.
- Het serialiseren per collectie is nog steeds werk; de winst zit in het **niet**
  opnieuw versleutelen en wegschrijven van wat niet veranderde, en in het wegvallen
  van de 512 MB-grens.

## Getoetst

`test/geheugen.test.js` bewijst het beloofde: round-trip op de byte, geen enkel
gevoelig veld leesbaar op schijf, alleen de veranderde collectie herschreven, een
verwijderde collectie opgeruimd, en — het belangrijkste — dat geknoei met een brok
of een kapot manifest opvalt en netjes terugrolt naar de vorige consistente
generatie. En **De Beproeving** (`RTG_STORE=geheugen npm run beproeving`) draait de
hele standaard-megatest bovenop deze motor: boot, elk endpoint, geld op de cent,
de misbruik-beproeving en de duurzaamheid-na-herstart.
