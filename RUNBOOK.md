# Het runbook

Eén pagina voor iemand die dit huis moet **draaien** in plaats van bouwen: wat is
het commando, en waar staat het volledige verhaal.

Dit bestand is met opzet een **index en geen tweede handleiding**. De uitvoerige
uitleg staat in `PRODUCTION.md` (productie, TLS, backup, schalen) en `README.md`
(hoe de code werkt); die zijn de bron. Zou het hier ook voluit staan, dan lopen de
twee binnen een maand uiteen -- precies de dubbele boekhouding waar `LAT.md`
regel 4 over gaat. Wat hier wél staat en nergens anders: de volgorde waarin je
dingen doet, en wat er gebeurt als het misgaat.

Voor de kaart van de code: `ARCHITECTUUR.md`. Voor wat de toetsen bewijzen:
`BEWIJS.md`. Voor wat er nog open staat: `TAKEN.md`.

---

## 1. Installeren en starten

**Vereisten:** Node 22.13 of hoger (de app draait op de ingebouwde `node:sqlite`, die is
Node's eigen SQLite -- er zit geen enkele externe dependency in dit project).

```bash
git clone <repo> && cd nieuwe-rtg-website
npm start                       # http://localhost:3000
```

Er is geen `npm install`-stap nodig omdat er niets te installeren is. De datamap
(`server/data/`) en de sleutels (`secret.key`, `vault.key`) maakt de app zelf aan
bij de eerste start. `server/data/` staat in `.gitignore` en hoort daar te blijven.

| Wil je | Commando |
|---|---|
| gewoon draaien | `npm start` |
| één proces, geen poortwachter | `npm run single` |
| drie servers achter een poortwachter | `npm run gateway` |
| elke app zijn eigen proces (foutisolatie) | `npm run vloot` |
| met Docker | `docker compose up` (zie `PRODUCTION.md` §1) |
| terug naar de seed-data | `rm server/data/db.json` en opnieuw starten |

**Met een telefoon erbij: zet TLS aan.** Buiten https (en localhost) geeft een
browser camera, microfoon en locatie niet vrij, dus op `http://192.168.x.x` doet
geen enkel camerascherm iets. `npm run telefoon` start de lokale drielaag met
een self-signed certificaat; op het toestel accepteer je eenmalig de
waarschuwing. Voor één los serverproces blijft `RTG_TLS=1 npm run single`
beschikbaar. De server noemt zelf het adres waar de telefoon heen moet
(`server/opzet/veiligadres.js`).

## 2. Voor je live gaat

In deze volgorde, want de eerste stap kan de rest overbodig maken:

```bash
npm run sleutels -- --schrijf # maakt alle productiegeheimen en schrijft .env.productie
npm run release:gate         # build + Rust + security + audit + echte herstelproef + hashbewijs
npm run golive        # de eigen go-live keuring: exitcode 1 zolang er iets open staat
npm run keuring       # 41 binaire regels over de bron
npm test              # de servertoetsen (duurt lang)
npm run e2e           # de schermtoetsen (heeft een browser nodig)
npm run norm          # de ratel: is er iets slechter geworden?
npm run papierwerk    # de juridische vragen (AVG art. 30, datalek-draaiboek)
```

`npm run golive` is de poort. Wat hij noemt staat ook in `TAKEN.md` §1 met per
regel waarom het blokkeert. De vijf productiegeheimen en de achttien juridische
vragen kan code niet voor je oplossen; die staan daar met naam.

Voor de volledige checklist: `PRODUCTION.md` §6.

Een echte Compose-uitrol loopt via `npm run deploy:productie`. De uitrol raakt
Docker pas nadat `release:gate:productie` groen is, wacht op de healthchecks en
herstelt bij falen automatisch de twee vorige image-ID's. De bon staat onder
`.release/`; handmatig: `npm run deploy:terug -- .release/uitrol-...json`.

## 3. Backup en herstel

De server maakt elke dag zelf een backup in `<datamap>/backups/<datum>/`.

**De sleutels zitten er bewust NIET in.** Een backup met de sleutel erin opent
zichzelf. Gevolg: zonder `RTG_VAULT_KEY` en `RTG_SECRET_KEY` uit je secrets
manager krijg je na een herstel alle accounts terug maar geen enkele naam.

```bash
systemctl stop rtg                              # of: docker compose down
cp <datamap>/backups/<datum>/* <datamap>/
export RTG_VAULT_KEY=... RTG_SECRET_KEY=...     # uit de secrets manager
systemctl start rtg
```

Controleer daarna twee dingen, en het tweede is het echte bewijs: een bestaand lid
kan inloggen, **en** zijn echte naam is zichtbaar. Dat laatste bewijst dat de kluis
het weer doet.

**Oefen dit, geloof het niet.** `test/herstelproef.test.js` loopt de hele ronde
automatisch: aanmaken, backuppen, datamap wissen, terugzetten, opstarten,
controleren.

```bash
npm test -- test/herstelproef.test.js                    # doet de ronde echt
node scripts/hersteltijd.js 250000  # met een stopwatch
```

Gemeten RTO, RPO, en de twee dingen die die cijfers níet zeggen: `PRODUCTION.md`
§3 "Backup en herstel". Doelstellingen: `SLO.md`.

## 4. Als er iets stuk is

| Symptoom | Eerste stap |
|---|---|
| de site is traag of geeft 503 | `curl /api/health` en `/api/ready`; De Wacht doet aan load shedding, dus 503 kan een bewuste weigering zijn |
| camera/microfoon doet niks op een toestel | is het adres https? Zo niet, dat is het (zie §1). De app zegt het zelf in beeld |
| een lid kan inloggen maar heeft geen naam | de kluissleutel (`RTG_VAULT_KEY`) klopt niet of ontbreekt |
| e-mail komt niet aan | zonder `SMTP_URL` of `MAIL_DIRECT=1` gaat alles naar de outbox: `npm run outbox` |
| betalingen gaan door zonder af te rekenen | dan draait de demo-provider: `STRIPE_SECRET_KEY` ontbreekt. `TAKEN.md` 1.5 |
| een storing en niemand merkt het | er is geen externe alarmering zolang `ERR_WEBHOOK_URL` leeg is. `TAKEN.md` 2.1 |
| na een uitrol is een pagina lelijk of stil | `npm run build` vergeten? De bundels in `public/apps/*.js` worden uit de delen-map gebouwd |

Voor een datalek is er een eigen draaiboek met de 72-uursklok: `DATALEK.md`.

## 5. Meten en onderhouden

| Vraag | Commando |
|---|---|
| is er iets slechter geworden? | `npm run norm` |
| wat is de architectuur nu? | `npm run kaart` (schrijft `ARCHITECTUUR.md`) |
| wat bewijst welke toets? | `npm run bewijs` (schrijft `BEWIJS.md`) |
| kan een toets eigenlijk zakken? | `npm run mutatie` (schrijft `MUTATIES.json`; het serverdeel duurt uren en is hervatbaar) |
| hoe breed reikt een domein in de kern? | `npm run grenzen` |
| welke endpointgroepen kunnen liegen zonder dat een toets omvalt? | `npm run leugens` (lang: een volle suite per groep) |
| hoe houdt hij het onder last? | `npm run beproeving` |
| welke endpoints raakt niemand aan? | `npm run dekking` |
| toegankelijkheid | `npm run a11y` |
| klopt het gebouwde releasepakket nog byte voor byte? | `npm run release:controle` |
| draait hier het image dat wij gebouwd hebben? | `npm run imageherkomst:controle -- --draait=<digest>` (zonder `--draait` toets je alleen de handtekening) |
| wat zit er in dat image? | `.release/sbom.json` uit de release-run, of `npm run sbom -- --image=<verwijzing>` |
| meten vanaf een andere machine | `node scripts/sonde.js https://jouwdomein --melden --token=...` |

Na een wijziging aan de code horen `ARCHITECTUUR.md` en `BEWIJS.md` mee te
verschuiven; regel 40 en 41 van `npm run keuring` maken de keuring rood zolang dat
niet is gebeurd. Bijwerken is een commando, geen schrijfwerk.

### Een collectie wissen uit de gedeelde opslag

**Doe dit nooit met `DELETE FROM kv`.** Dat werkt niet zoals je denkt, en het
faalt stil.

Elke node houdt een lokale snapshot als warme cache. Bij het opstarten wint
Postgres alleen *voor elke collectie die hij heeft*. Een rij die je met de hand
hebt verwijderd, heeft hij niet — dus wint de verouderde snapshot van de eerste
de beste node die opstart, en die schrijft hem daarna gewoon terug. De collectie
herrijst. Dat is geen theorie: het is gereproduceerd (`TAKEN.md` 4.38), en het
is precies zo een keer gebeurd met een automatische lastafworp.

| Wat je wilt | Hoe |
|---|---|
| een collectie **weg** | `npm run kvwis -- <collectie>` |
| zien wat er staat | `npm run kvwis -- --lijst` |
| een collectie **leegmaken** maar houden | via de applicatie; een lege collectie flusht en wint gewoon |

`npm run kvwis` laat een **grafsteen** achter: de rij blijft staan met
`weg = true`. Elke node past dat verwijderen alsnog toe — draaiende instances
binnen enkele seconden via NOTIFY, en een node die later opstart bij het
opstarten. Ook een node die maanden uit heeft gestaan.

Een grafsteen is geen verbod op de naam: vult de applicatie de collectie later
opnieuw, dan wordt hij gewoon weer geschreven en is de grafsteen opgeheven.

Wist iemand toch met de hand, dan kan de server dat niet ongedaan maken — zonder
rij is er geen spoor. Wat hij wél doet is het **luid melden** bij het opstarten:
welke collecties de snapshot wel heeft en Postgres niet, met naam en aantal
items. Zie je die melding, dan staan er twee waarheden naast elkaar; draai
alsnog `npm run kvwis` voor de collectie die weg moest.

## 6. Wat code nog steeds niet alleen kan

- **De domein- en serverkeuze.** De uitrolpijplijn, automatische rollback,
  native HTTPS, externe sonde en het herstelpad staan nu in `LIVEGANG.md`, maar
  DNS en de echte productiemachine moet de eigenaar aanwijzen.
- **Externe meldingen activeren.** De app meet zichzelf (`/api/health`) en de
  GitHub-sonde meet van buitenaf. Zet repository variable `RTG_LIVE_URL`,
  Actions-meldingen en bij voorkeur `ERR_WEBHOOK_URL` aan; code kan niet kiezen
  wie een storing om 03:00 uur ontvangt.
- **Een tweede persoon die dit kan.** De bus factor is één, en geen document
  verandert dat. Wat deze pagina wel doet: het verkleint wat iemand moet weten
  voordat hij begint. Wat er nog moet: iemand die het één keer echt doet, met dit
  runbook ernaast, en opschrijft waar hij vastliep.
