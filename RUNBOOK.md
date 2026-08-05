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

**Vereisten:** Node 22 of hoger (de app draait op `--experimental-sqlite`, dat is
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
geen enkel camerascherm iets. `RTG_TLS=1 npm start` geeft meteen https met een
self-signed certificaat; op het toestel accepteer je eenmalig de waarschuwing. De
server noemt bij het opstarten zelf het adres waar de telefoon heen moet
(`server/opzet/veiligadres.js`).

## 2. Voor je live gaat

In deze volgorde, want de eerste stap kan de rest overbodig maken:

```bash
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
node --experimental-sqlite scripts/hersteltijd.js 250000  # met een stopwatch
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
| hoe breed reikt een domein in de kern? | `npm run grenzen` |
| welke endpointgroepen kunnen liegen zonder dat een toets omvalt? | `npm run leugens` (lang: een volle suite per groep) |
| hoe houdt hij het onder last? | `npm run beproeving` |
| welke endpoints raakt niemand aan? | `npm run dekking` |
| toegankelijkheid | `npm run a11y` |

Na een wijziging aan de code horen `ARCHITECTUUR.md` en `BEWIJS.md` mee te
verschuiven; regel 40 en 41 van `npm run keuring` maken de keuring rood zolang dat
niet is gebeurd. Bijwerken is een commando, geen schrijfwerk.

## 6. Wat hier NIET staat, en dat is geen oversight

- **Een uitrolpijplijn.** Er is geen CI/CD-beschrijving voor een echte omgeving,
  want er is nog geen echte omgeving. Wat er is: `.github/workflows/ci.yml` draait
  de keuring en de toetsen op elke push.
- **Monitoring en alarmering.** De app meet zichzelf (`/api/health`,
  `scripts/beproeving.js`, `SLO.md`), maar er staat geen externe waakhond op. Dat
  is `TAKEN.md` 2.1 en het is een bewust open punt.
- **Een tweede persoon die dit kan.** De bus factor is één, en geen document
  verandert dat. Wat deze pagina wel doet: het verkleint wat iemand moet weten
  voordat hij begint. Wat er nog moet: iemand die het één keer echt doet, met dit
  runbook ernaast, en opschrijft waar hij vastliep.
