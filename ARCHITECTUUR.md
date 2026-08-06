# De architectuur van RTG

**Dit bestand is GEGENEREERD** door `node scripts/kaart.js`. Wijzig het niet met de
hand: regel 40 van `npm run keuring` genereert opnieuw en vergelijkt, dus een
handmatige wijziging wordt bij de eerste keuring rood. Verschuift de code, dan
draai je het commando en commit je de nieuwe kaart mee.

Er staat met opzet **geen datum** in dit bestand: een tijdstempel zou de controle
elke dag laten zakken, en dan wordt de regel binnen een week uitgezet. Wanneer de
kaart voor het laatst is bijgewerkt, staat in de git-historie.

Waarom dit bestaat: 1253 servermodules en 2384 endpoints houdt niemand in zijn hoofd.
Een meetkast vertelt je of er iets stuk is, niet waar de dingen staan.

---

## 1. De maat van het huis

| Wat | Aantal |
|---|---|
| API-endpoints | 2384 |
| servermodules (`server/**/*.js`) | 1254 |
| routebestanden (`server/routes/**`) | 311 |
| kernmodules (`server/kern/**`) | 653 |
| schermen (`public/**/*.html`) | 198 |
| gedeelde browsermodules (`public/shared/*.js`) | 160 |
| toetsbestanden (`test/*.test.js`) | 549 |
| schermtoetsen (`test/*.e2e.js`) | 69 |

## 2. De weg van een verzoek

De voordeurketen staat in `server/opzet/verzoekketen.js` en de volgorde daarin is
gedrag, geen smaak. Van buiten naar binnen:

1. **`schildwacht`** -- het schild en De Wacht (quarantaine, load shedding).
2. **`koppen`** -- de security-headers en de terugval-CSP.
3. **`poortwachters`** -- snelheidsremmen, functieschakelaars, scan-net, statische bestanden.
4. **`liegpoort`** -- inert zonder `RTG_LIEG`; laat een groep endpoints met opzet liegen zodat je ziet of een toets dat merkt.
5. **`lijfpoort`** -- webhooks vóór `express.json`, dieptebewaking, het zaakdoos-journaal.
6. **de routers** -- per domein opgehangen door `server/opzet/routes.js`.
7. **`afsluiters`** -- de 404 en de centrale foutafhandeling.

## 3. De opstartlagen

`server/server.js` bouwt één object `kern` en geeft dat aan alles. De samenstelling
is geknipt **op positie en niet op thema**, want de bouwvolgorde is gedrag; de volle
uitleg staat alleen in `server/opzet/kernlaag1.js` en de andere lagen wijzen daarheen.

Aangeroepen lagen, in volgorde:

```
web
db
translate
accounts
eigenaar
mail
log
betaal
muntbetaal
talen
foutmelder
config
inzagelog
verzoekketen
poortwachters
ai
diensten
media
kluis
rem
pinslot
kernlaag1
kernlaag2
kernlaag3
kernlaag4
kernlaag4b
kernlaag5
kernlaag6
kernlaag7
start
afsluiters
backup
opslagstart
bewaarveger
startcontrole
luister
```

## 4. De domeinen

Acht domeinen, uit `server/opzet/routes.js`. Met `RTG_DOMAINS=member,social` draait
een proces alleen die domeinen; een gateway (`server/poort.js`) stuurt de
padvoorvoegsels dan naar het juiste proces. **Die belofte is nog niet waargemaakt:**
zie §5 -- er zijn nog 136 kern-namen die meer dan één domein aanraakt.

| Domein | Endpoints | Routebestanden | Zonder bewaker | Bereik in kern |
|---|---|---|---|---|
| `auth` | 19 | 5 | 8 | 41 |
| `member` | 391 | 47 | 9 | 342 |
| `supplier` | 481 | 87 | 6 | 269 |
| `office` | 31 | 7 | 3 | 52 |
| `staff` | 25 | 5 | 1 | 38 |
| `social` | 55 | 6 | 31 | 52 |
| `techniek` | 42 | 11 | 1 | 49 |
| `zakelijk` | 13 | 2 | 0 | 27 |

"Zonder bewaker" betekent: geen `auth`/`supplierAuth`/`officeAuth`-achtige middleware
op de regel zelf. Dat is niet hetzelfde als onbeveiligd -- regel 28 van de keuring eist
per route een poort **of** een plek op de publieke lijst met reden. Deze kolom is een
wegwijzer, geen verdict.

Daarnaast 1041 `/api/`-endpoints buiten deze acht: de infra (health, stream, push,
cluster, translate), de foundation-mount, SSO, SCIM, onboarding en de losse takken
(school, bank, pay, bestanden, agenda). Die draaien altijd mee.

## 5. De gedeelde kern, en wat er niet in hoort

| Meting | Nu |
|---|---|
| kern-namen die routes aanraken | 986 |
| daarvan door **meer dan één** domein (de echte koppeling) | 136 |
| daarvan door precies één domein | 850 |
| breedste enkele routebestand | 71 namen |
| gepakt uit kern en nergens gebruikt | 0 |

Dat derde getal is de opening: 86% van wat er in de gedeelde zak zit, wordt door
precies één domein gebruikt. Dat hoort geen gedeelde kern te zijn maar bezit van dat
domein. Alle vijf getallen staan in `NORM.json` aan een ratel en mogen alleen zakken.

**De echte interface** -- namen die vijf of meer domeinen aanraken. Dit is wat een
domein van buiten nodig heeft, en dus wat er zou moeten overblijven:

```
app(111) auth(66) supplierAuth(44) db(30) officeAuth(21) liveCodename(17) status(16)
accounts(12) managerOnly(11) save(11) rtf(11) crypto(9) express(9) anthropic(9)
rtmail(9) codenaamVan(9) schoon(8) tooManyTries(7) logActivity(7) sseToOffice(7)
keyVanCodenaam(7) geenGast(6) talen(6) boardroomWie(5) noteFailedTry(5) sseToSupplier(5)
kern(5) gegevensStop(5)
```

**De breedste routebestanden** -- hier zou je beginnen:

| Namen uit kern | Bestand |
|---|---|
| 71 | `server/routes/member/rechterhand.js` |
| 41 | `server/routes/member/voertuigen/huur.js` |
| 40 | `server/routes/member/voertuigen/charter.js` |
| 40 | `server/routes/member/voertuigen/verkoop.js` |
| 40 | `server/routes/member/voertuigen.js` |
| 39 | `server/routes/member/voertuigen/ontmoeten.js` |
| 36 | `server/routes/auth.js` |
| 34 | `server/routes/member/handel/uitjes.js` |
| 34 | `server/routes/staff.js` |
| 33 | `server/routes/auth/account.js` |

## 6. Waar de waarheid staat

| Vraag | Waar |
|---|---|
| Hoe start ik dit, hoe zet ik het live, hoe herstel ik het? | `RUNBOOK.md` |
| Hoe hoort er code geschreven te worden? | `LAT.md` (negen regels, elk uit een echte fout) |
| Welke merkregels gelden? | `CLAUDE.md` |
| Wat moet er nog, en welke schuld staat er open? | `TAKEN.md` |
| Welke toets bewijst wat? | `BEWIJS.md` |
| Wat is er gemeten, en welke kant mag het op? | `NORM.json` + `npm run norm` |
| Welke endpointgroepen kunnen liegen zonder dat een toets omvalt? | `LEUGENS.json` + `npm run leugens` |
| Wat draait er in productie en wat moet er nog geregeld? | `PRODUCTION.md` |
| Wat doet de code technisch? | `README.md` |

## 7. Hoe je dit bestand bijwerkt

```
node scripts/kaart.js              # opnieuw genereren
node scripts/kaart.js --controle   # zakt als de kaart achterloopt (regel 40)
```
