# De architectuur van RTG

**Dit bestand is GEGENEREERD** door `node scripts/kaart.js`. Wijzig het niet met de
hand: regel 40 van `npm run keuring` genereert opnieuw en vergelijkt, dus een
handmatige wijziging wordt bij de eerste keuring rood. Verschuift de code, dan
draai je het commando en commit je de nieuwe kaart mee.

Er staat met opzet **geen datum** in dit bestand: een tijdstempel zou de controle
elke dag laten zakken, en dan wordt de regel binnen een week uitgezet. Wanneer de
kaart voor het laatst is bijgewerkt, staat in de git-historie.

Waarom dit bestaat: 1253 servermodules en 4748 endpoints houdt niemand in zijn hoofd.
Een meetkast vertelt je of er iets stuk is, niet waar de dingen staan.

---

## 1. De maat van het huis

| Wat | Aantal |
|---|---|
| API-endpoints | 4748 |
| servermodules (`server/**/*.js`) | 2883 |
| routebestanden (`server/routes/**`) | 541 |
| kernmodules (`server/kern/**`) | 1806 |
| schermen (`public/**/*.html`) | 277 |
| gedeelde browsermodules (`public/shared/*.js`) | 281 |
| toetsbestanden (`test/*.test.js`) | 1242 |
| schermtoetsen (`test/*.e2e.js`) | 175 |

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
testomgeving
betaal
muntbetaal
talen
foutmelder
config
inzagelog
verzoekketen
poortwachters
ai
ai-stand
leverancierpoort
diensten
media
kluis
rem
pinslot
kernlaag1
kernlaag2
kernlaag2b
kernlaag3
kernlaag3c
kernlaag3w
kernlaag3b
kernlaag4
kernlaag4b
kernlaag4c
kernlaag5
kernlaag5f
kernlaag6
kernlaag7
kernlaag7b
start
afsluiters
backup
opslagstart
onderhoud
bewaarveger
startcontrole
luister
```

## 4. De domeinen

Acht domeinen, uit `server/opzet/routes.js`. Met `RTG_DOMAINS=member,social` draait
een proces alleen die domeinen; een gateway (`server/poort.js`) stuurt de
padvoorvoegsels dan naar het juiste proces. **Die belofte is nog niet waargemaakt:**
zie §5 -- er zijn nog 212 kern-namen die meer dan één domein aanraakt.

| Domein | Endpoints | Routebestanden | Zonder bewaker | Bereik in kern |
|---|---|---|---|---|
| `auth` | 19 | 6 | 8 | 48 |
| `member` | 671 | 64 | 14 | 413 |
| `supplier` | 615 | 118 | 6 | 309 |
| `office` | 59 | 15 | 3 | 75 |
| `staff` | 26 | 8 | 1 | 42 |
| `social` | 76 | 10 | 31 | 70 |
| `techniek` | 68 | 16 | 1 | 55 |
| `zakelijk` | 13 | 2 | 0 | 25 |
| `wereld` | 15 | 3 | 0 | 0 |

"Zonder bewaker" betekent: geen `auth`/`supplierAuth`/`officeAuth`-achtige middleware
als EIGEN LAAG voor de handler -- gelezen uit de router zelf (`app._routes()`), niet
meer geraden uit de brontekst. Dat is niet hetzelfde als onbeveiligd, en dat verschil
is hier echt: honderden routes controleren een capability-token IN de handler (de
lessen en schoolborden van de RTFoundation bijvoorbeeld) en hebben dus geen
bewakerslaag. Regel 28 van de keuring eist per route een poort **of** een plek op de
publieke lijst met reden. Deze kolom is een wegwijzer, geen verdict.

Daarnaast 3176 `/api/`-endpoints buiten deze acht: de infra (health, stream, push,
cluster, translate), de foundation-mount, SSO, SCIM, onboarding en de losse takken
(school, bank, pay, bestanden, agenda). Die draaien altijd mee.

## 5. De gedeelde kern, en wat er niet in hoort

| Meting | Nu |
|---|---|
| kern-namen die routes aanraken | 1501 |
| daarvan door **meer dan één** domein (de echte koppeling) | 212 |
| daarvan door precies één domein | 1289 |
| breedste enkele routebestand | 71 namen |
| gepakt uit kern en nergens gebruikt | 0 |

Dat derde getal is de opening: 86% van wat er in de gedeelde zak zit, wordt door
precies één domein gebruikt. Dat hoort geen gedeelde kern te zijn maar bezit van dat
domein. Alle vijf getallen staan in `NORM.json` aan een ratel en mogen alleen zakken.

**De echte interface** -- namen die vijf of meer domeinen aanraken. Dit is wat een
domein van buiten nodig heeft, en dus wat er zou moeten overblijven:

```
app(189) auth(115) supplierAuth(63) officeAuth(41) db(37) liveCodename(34) status(28)
accounts(25) schoon(23) managerOnly(18) codenaamVan(17) save(16) rtf(15)
boardroomWie(14) geenGast(13) crypto(12) tooManyTries(11) express(11) findSupplier(11)
pay(11) anthropic(11) keyVanCodenaam(10) rtmail(10) gegevensStop(9) logActivity(9)
boardroomAuth(9) sseToOffice(9) payrollOS(9) kern(8) stuur(8) appUrl(7) mail(7)
noteFailedTry(7) sseToSupplier(7) onboarding(6) notifySupplier(6) talen(6) tenant(5)
loginFails(5) logInlog(5) overheid(5) sseToCustomer(5)
```

**De breedste routebestanden** -- hier zou je beginnen:

| Namen uit kern | Bestand |
|---|---|
| 71 | `server/routes/member/rechterhand.js` |
| 42 | `server/routes/auth/account.js` |
| 41 | `server/routes/member/voertuigen/huur.js` |
| 40 | `server/routes/member/voertuigen/charter.js` |
| 40 | `server/routes/member/voertuigen/verkoop.js` |
| 40 | `server/routes/member/voertuigen.js` |
| 39 | `server/routes/member/voertuigen/ontmoeten.js` |
| 38 | `server/routes/staff.js` |
| 34 | `server/routes/auth/herstel.js` |
| 34 | `server/routes/member/handel/uitjes.js` |

## 6. Waar de waarheid staat

| Vraag | Waar |
|---|---|
| Hoe start ik dit, hoe zet ik het live, hoe herstel ik het? | `RUNBOOK.md` |
| Hoe hoort er code geschreven te worden? | `LAT.md` (negen regels, elk uit een echte fout) |
| Welke merkregels gelden? | `CLAUDE.md` |
| Waar bouwen we naartoe, en wat staat daarbij in de weg? | `PLATFORM.md` |
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
