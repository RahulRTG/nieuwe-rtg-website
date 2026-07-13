# Naar een 9,5 — verbeter-roadmap

Een levende checklist met concrete, gedragsbehoudende verbeteringen die de apps
naar 9,5 tillen. Elk punt is los uitvoerbaar met de testsuite (`npm test`),
de scherm-tests (`npm run e2e`) en `npm run check` / `npm run a11y` als vangnet.

Legenda: [x] gedaan · [~] begonnen (referentie staat er) · [ ] open

## 1. Frontend-consistentie: gedeelde app-shell
De grote apps rolden elk hun eigen `API`, `restoreSession`, realtime-koppeling en
toast uit. Doel: één gedeelde laag, zodat elke app zich identiek gedraagt.

- [x] Gedeelde verbindingslaag `public/shared/verbinding.js` (offline-banner +
  `RTGNet.fout` + `RTGNet.haal`), ingesloten in alle flagship-apps.
- [x] `public/shared/appshell.js`: canonieke `API`-factory (`RTGApp.maakAPI`).
- [x] Migreer `personeel.html` (rijkste e2e-dekking) als referentie.
- [ ] `bootSession({tokenKey, statePad, onState})` + realtime-wiring toevoegen aan de shell.
- [x] Migreer `app.html`, `leverancier.html`, `backoffice.html` naar RTGApp.maakAPI
  (elk gedekt door een e2e-boot-test die login + geen JS-fouten bewijst).

## 2. Escaping structureel (veiligheid)

Opgemerkt en gedicht: renderPChat (leden-partnerchat) zette de afzendernaam (m.who)
ongefilterd in de HTML -> nu Util.el (structureel veilig). Interactie-e2e voor de
partnerchat is uitgesteld (city-gefilterde lijst + gastchat-toggle maken de opzet
broos); geverifieerd met check + a11y (pagina laadt schoon).
115 handmatige `esc()`-aanroepen = 115 plekken om te vergeten. Het
componentframework (`util.js`) dwingt escaping af maar wordt door ~4 van de apps
gebruikt.

- [x] Referentie: PDA-trainingskaart gebouwd met `Util.el` (geen `esc()` meer).
- [x] renderOrders (leverancier) + home-kaarten (reis/betalen) + de codenaam-kaart
  + het conciergegesprek + de partnerchat (leden) naar Util.el, elk met e2e.
- [ ] overige hete render-functies (Salon is al veilig via esc, deprio) nog open.
- [ ] `check.js`-regel die `innerHTML +=` met een niet-ge-escapete variabele markeert.

## 3. Stille fouten wegnemen (beleving)
51 lege `catch(e){}` in de apps: bij een mislukte call ziet de gebruiker niets.

- [x] `RTGNet.fout()` en de offline-banner beschikbaar in alle apps.
- [ ] Vervang de lege catches door `RTGNet.fout(...)` + waar zinvol een
  "opnieuw proberen"-knop.
- [ ] Skeleton-loaders i.p.v. lege schermen tijdens het laden.

## 4. server.js opknippen (laatste god-file)
`server.js` was 3032 regels met 114 top-level helpers.

- [x] `server/kern/util.js`: zuivere hulpjes (schoon, ledenPrijs, centen,
  entree/pickupCode) eruit, los getest (`test/kern-util.test.js`).
- [x] `server/kern/afgeleid.js`: publicPartner, weekdagFactor, cvReady + de
  btw-splitsing (btwSplit) eruit, los getest (`test/kern-afgeleid.test.js`).
  Geo (`server/lib/geo.js`) en leeftijd (`server/lib/leeftijd.js`) waren al los.
- [ ] Groepeer de resterende staat-dragende helpers (sessies, SSE) in eigen
  modules met een duidelijke `maak…(state)`-fabriek.
- [ ] Groepeer de staat-dragende helpers (sessies, SSE) in eigen modules met een
  duidelijke `maak…(state)`-fabriek.

## 5. i18n compleet maken
248 `data-i18n`-attributen, maar er staan nog hardcoded NL-teksten (o.a. in
`leverancier.html`). Engelstalige gebruikers zien dan half Nederlands.

- [ ] Sweep resterende zichtbare strings naar `T(...)` / `data-i18n`.
- [ ] CI-check die zichtbare tekst zonder i18n-sleutel markeert.

## 6. Inline styles → klassen
`app.html` 396 en `leverancier.html` 353 inline `style="…"`-attributen.

- [~] Terugkerende patronen naar utility-klassen: `.fineprint` (leden, was 6x
  inline) en `.softline` (leverancier, was 10x) eruit; exacte hele-stijl-matches
  op klasseloze `<div>`s, dus gedragsbehoudend. Grotere sweep vraagt een
  visuele-diff-vangnet (anders kans op subtiele regressies).
- [ ] Scheelt bytes na minify en maakt thema-/merkwijzigingen veilig.

## 7. Diepere toegankelijkheid
Axe is groen (0 serious/critical), maar dat dekt geen focusbeheer of toetsenbord.

- [x] PDA, leden- en leverancier-app: focus naar de nieuwe view bij een echte
  tabklik + aria-current op de actieve tab (e2e bewijst aria-current).
- [~] `role`/`tabindex` op de PDA-views; keydown op custom controls elders nog open.
- [x] `prefers-reduced-motion` respecteren (globaal via i18n.js, 0.01ms zodat
  transitionend/animationend blijven werken).

## 8. Testdekking verbreden
- [x] Scherm-tests: PDA-training, PDA-aandacht, boot van leverancier/lid/backoffice,
  offline-banner (`npm run e2e`, 6 tests).
- [x] Interactie-e2e voor de kassa (bestellen+betalen -> Orders -> in bereiding).
- [ ] Contracttests voor de belangrijkste API-antwoorden.

## 9. Schaal (bewuste keuze, geen code-fix)
Bekende plafonds: single-proces ~1.400–1.700 req/s en het JSON-snapshot-plafond
(gemitigeerd door het grootboek).

- [ ] In `PRODUCTION.md` expliciet documenteren: horizontaal uitschalen achter de
  poortwachter + Redis/Postgres overal aan voor echte miljoenen.
- [ ] Virtualisatie van zeer lange lijsten in de backoffice.

## Aanbevolen volgorde
1. app-shell (#1) — betaalt zich terug bij elke volgende stap.
2. stille catches → `RTGNet.fout` (#3) — direct voelbaar.
3. verder server.js → `server/kern/` (#4).
Daarna #2 (escaping), #5 (i18n), #6 (styles), #7 (a11y) per app.
