# RTG V1 — RELEASE READINESS AUDIT

*Volledige end-to-end release-audit van de gehele RTG-codebase. Doel: één vraag —
kan RTG V1 verantwoord naar productie voor echte gebruikers, bedrijven en
organisaties?*

- **Commit:** `b7f14dfa` (main, 5 oktober 2026)
- **Methode:** 12 parallelle, read-only dimensie-audits (authN, authZ, isolatie,
  betalingen, data/transacties, websec, secrets/deploy, privacy/AVG,
  reliability, architectuur, frontend↔backend, observability/tests). Elke
  P0/P1-bevinding adversarieel nagetrokken tegen de echte code. De twee zwaarste
  bevindingen zijn door de auditor zélf gereproduceerd/narekend.
- **Bewijsbasis:** de code is leidend. De ~150 `.md`-documenten en ~200
  `.json`-registers in de repo zijn als **claims** behandeld, niet als bewijs;
  afwijkingen staan expliciet gemeld. Veel registers lopen enkele dagen tot
  weken achter op `HEAD`.
- **Zelf uitgevoerd (read-only):** Rust-motor gebouwd; volledige Node-testsuite
  gedraaid tegen echte PostgreSQL 16 + Redis (15.773 tests); de 2FA-bypass
  live gereproduceerd tegen de echte `accounts`-module; webhook-,
  meldingen- en productie-gating-code regel-voor-regel geverifieerd.
- **Niet verifieerbaar in deze omgeving:** gedrag tegen een echte productiehost
  (TLS/ACME/DNS/objectopslag/SMTP/betaalprovider), de low-level pgwire-driver
  onder echte concurrency, en de externe/juridische vrijgave-items. Deze staan
  als zodanig gemarkeerd.

---

## A. EXECUTIVE VERDICT

### 🔴 NO-GO
**Release readiness: 70/100**

1. De technische grondslag is **sterk en op veel punten aantoonbaar
   productierijp** (betalingen, cryptografie/kluis, PostgreSQL-transacties, CSP,
   auditspoor, backup/herstel, AVG-wissing). Dit is geen fragiele codebase.
2. **Maar twee bevestigde P0's blokkeren een publieke V1** en bijten juist in
   productie (onzichtbaar in de demo-opzet).
3. **P0-1 — volledige 2FA-bypass + sessie-uit-e-maillink.** `verifyToken`
   onderscheidt een sessietoken niet van een actietoken; elk `inlog2`- of
   `verify-email`-token werkt als volwaardige sessie. **Door de auditor live
   gereproduceerd.**
4. **P0-2 — cross-member privacylek (AVG).** Persoonlijke meldingen (boekingen,
   conciërge-/gast-chat, identiteitsverificatie) komen in een per-pas gedeelde
   bak + SSE-broadcast en zijn zichtbaar voor álle leden met dezelfde pas.
5. **P1 — productie-hardening hangt aan `NODE_ENV=production`.** De ondersteunde
   Docker/golive-weg zet die en is veilig, maar een publieke deploy die hem
   vergeet opent de backoffice (identiteitskluis, paspoortscans) op een gedeelde
   code en zet encryptie-at-rest stil uit. Door 4 onafhankelijke dimensies
   gezien.
6. **De testsuite is ROOD op de release-commit** (`test/schermeigenaar.test.js`
   faalt: `site/techniek/techniek.html` ontbreekt in `SCHERMEIGENAAR.json`). De
   release-gate eist een volledig groene, skip-vrije suite, dus hij kan vandaag
   hoe dan ook niet READY worden.
7. **Externe/juridische randvoorwaarden zijn niet vervuld** (en kúnnen niet in
   code worden opgelost): geen onafhankelijke pentest, geen bewezen
   productiehost/TLS, geen getekende DPIA/verwerkersovereenkomsten, geen
   besluit over het geldmodel/uitbetaalprovider. Deze blokkeren een
   verantwoorde launch onafhankelijk van de P0's.
8. **De code-blockers zijn weinig en lokaal.** P0-1 en P0-2 zijn elk een kleine,
   geïsoleerde reparatie; de P1 is een fail-safe-default-wijziging. De afstand
   in *codewerk* tot CONDITIONAL GO is klein.
9. **Waarom 70 en niet lager:** het overgrote deel van de ~5.182 routes, de
   geldlaag en de dataconsistentie zijn solide; 15.770/15.773 tests groen; de
   gevaarlijkste stromen (AVG-wissing, betaalwebhook, ongeverifieerde
   betaalbevestiging) zijn met echte modules beproefd, niet gemockt.
10. **Waarom niet hoger:** twee live exploiteerbare security/privacy-gaten, een
    rode suite op de release-commit, en een reeks onvervulde externe/legale
    poorten maken een publieke launch vandaag onverantwoord.

**Samengevat:** een smalle NO-GO. Repareer P0-1 en P0-2, maak de P1-hardening
deploy-onafhankelijk, krijg de suite groen, en los de externe/legale poorten op
→ dan CONDITIONAL GO.

---

## B. V1 RELEASE BLOCKERS (P0/P1)

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **B1** | **P0** | `server/accounts/tokens.js` `verifyToken` | `verifyToken` ontleedt de body als `id.exp.uitgegeven.sid`, maar een actietoken is `id.purpose.exp.nonce`. `Number('inlog2')`=NaN, `NaN < Date.now()`=false → vervalcheck slaat niet aan; het echte account komt terug. Sessie- en actietokens worden met dezelfde `kluis.sign(S.SECRET)` getekend; geen enkele discriminator. | **Volledige 2FA-bypass:** wie alleen het wachtwoord kent krijgt bij `/api/auth/login` het `inlog2`-bewijs in de respons en gebruikt dat als `Bearer`-sessietoken zonder ooit TOTP in te voeren. Idem voor élk gelekt actietoken (`verify-email` = 3 dagen geldig, lekt via e-maillogs/referrer): sessie-escalatie. Altijd-actief pad, geen productiepoort dekt dit. | `tokens.js:124-125` (`[id,exp,uitgegeven,sid]=body.split('.'); if(Number(exp)<Date.now()) return null`); `tokens.js:146-151` (`body = userId+'.'+purpose+'.'+(…)+'.'+nonce`); bewijs teruggegeven in `server/kern/identiteit/tweefactor.js:164-167` + `server/routes/auth/inlog.js:136-137`. **Gereproduceerd:** inlog2- én verify-email-token → `verifyToken` geeft user id 1. | Teken actietokens met `kluis.sleutelVoor('actie:'+purpose)` (HKDF-domeinscheiding, bestaat al) zodat een sessieverifier ze cryptografisch nooit accepteert; in `verifyToken` ook `Number.isFinite(Number(exp))` eisen. Zie **K / Blocker 1**. |
| **B2** | **P0** | `server/opzet/meldingen.js` + `server/server.js` `meldingenVan` + SSE | `meld(tier,note)` schrijft in de **gedeelde** bak `db.data.notifications[tier]` en SSE-broadcast naar `match:[tier]` (`classificatie:'persoonsgegeven'`). `meldingenVan(sess)` geeft `db.data.notifications[sess.tier]` onverkort terug; voor een echt account is `tier` de pas-waarde, dus alle leden van één pas delen de bak. De sleutel-bak filtert de tier-bak niet weg. | **Cross-member AVG-lek:** elk lid ziet in `/api/notifications` én realtime de persoonlijke meldingen van alle leden met dezelfde pas — boekings-/order-/rit-bevestigingen (zaaknaam, datum), letterlijke conciërge- en gast-chatteksten, identiteitsverificatie-uitslagen. Treedt op in productie (meerdere echte accounts/pas), onzichtbaar in demo (key===tier). | `opzet/meldingen.js:65-70`; `server.js:1092-1100` (`opTier = db.data.notifications[sess.tier]`, altijd teruggegeven); `opzet/diensten2.js:216` (`tier:user.tier`); `kern/sse.js:66` (`m.doel==='tier'→raak=m.match.includes(c.tier)`); schrijvers o.a. `routes/supplier/boekingen.js:36`, `routes/office/werk.js:121`, `routes/supplier/gastcontact.js:44`, `routes/office/verificaties.js:99`. De code erkent de val zelf (`server.js:1080-1091`, `opzet/meldaan.js` kop). | Route persoonlijke meldingen via `meldLid(key)` → `db.data.notifications['user-'+id]`; reserveer `notify(tier)` voor echte broadcasts; laat `meldingenVan` de tier-bak alleen voor expliciet-broadcast-items lezen; fix `/api/notifications/read` idem. Zie **K / Blocker 2**. |
| **B3** | **P1** | `server/config/openbaar.js`, `server/config.js`, `server/kern/kantoor/productiedeur.js`, `server/opzet/poortwachters.js`, alle `server/middleware/*-productiepoort.js` | Vrijwel alle productie-hardening keyt op `NODE_ENV==='production'`: kantoordeur-passkey, config-keuring (kluissleutels, encryptie-at-rest, webhook-secrets), inlogrem, foundation-/legacy-/travel-/simulatiepoorten. Een publiek adres zónder `NODE_ENV=production` start met alleen schaduw-waarschuwingen; alleen de demo-combinatie is een harde fout. | Publieke deploy die de env-var vergeet: `/api/office/login` opent de backoffice (identiteitskluis, paspoortscans) op de gedeelde `OFFICE_CODE` zonder passkey; encryptie-at-rest/kluissleutels vallen stil terug op bestanden; onvolgroeide Foundation-routes staan open. Vereist operator-misconfiguratie; de ondersteunde Docker/compose/golive-weg zet `NODE_ENV=production` en is veilig. | `server.js:470`; `productiedeur.js:37,40-44,53-54`; `routes/office/toegang.js:11-16`; `config.js:66-73` (exit alleen in prod-tak); `config/openbaar.js:109-146` (openbaar-maar-niet-prod → schaduwFouten → waarschuwingen); `poortwachters.js:44`. Mitigatie: office heeft eigen rem (`toegang.js:13-19` + `server.js:589-632`), `OFFICE_CODE` is willekeurig (niet hardcoded). | Laat hardening afgaan op `openbaar.installatieSoort(env).soort==='openbaar'` **OF** `NODE_ENV==='production'`; promoveer de schaduwfouten tot `hardeFouten` zodra het adres aantoonbaar openbaar is (zoals demo-op-publiek al is). Zie **K / Blocker 3**. |
| **B4** | **P1→P2** | Release-gate / `test/schermeigenaar.test.js` | De volledige Node-suite is **rood op `b7f14dfa`**: `public/site/techniek/techniek.html` (toegevoegd door merge #473) staat niet in `SCHERMEIGENAAR.json`, dus de schermeigenaar-governancetoets faalt (2 subtests). De release-gate (`productie-oordeel.js`) eist een volledig groene, skip-vrije suite. | Zuiver release-gate-blokkerend, niet exploiteerbaar: zolang de suite rood is kan `productie:status`/`release:gate` nooit READY worden. Weerlegt de claim in `RELEASEKANDIDAAT.md` ("npm test → 0 gezakt", gemeten op oudere commit `115ceb85`). | **Zelf geverifieerd op de echte repo:** `node --test test/schermeigenaar.test.js` → `# fail 2`; `grep -c techniek/techniek.html SCHERMEIGENAAR.json` → 0; het bestand bestaat (`public/site/techniek/techniek.html`). | Registreer `site/techniek/techniek.html` in `SCHERMEIGENAAR.json` (capability + rol, of alias met oordeel); draai de volledige suite groen vóór enige release-stempel. Technisch triviaal, maar het is een harde poort. |

> B4 is op zichzelf P2 qua ernst, maar staat in deze tabel omdat hij de
> release-gate **nu** hard dichtzet en een gedocumenteerde claim weerlegt.

---

## C. SECURITY BLOCKERS

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **C1** | **P0** | authenticatie | = **B1** (2FA-bypass via actietoken). | Accountovername met alleen wachtwoord; sessie uit gelekte e-maillink. | zie B1 (gereproduceerd). | zie K/Blocker 1. |
| **C2** | **P1** | deploy-hardening | = **B3** (`NODE_ENV`-afhankelijke poorten). | Backoffice/kluis open bij één vergeten env-var. | zie B3. | zie K/Blocker 3. |
| **C3** | **P2** | `server/routes/member/tweefactor.js` | `/api/auth/tweede` (TOTP-controle) kent geen eigen pogingenrem binnen het 5-min bewijsvenster. | TOTP brute-forcebaar binnen het venster (verzwakt door de korte TTL). | `routes/member/tweefactor.js:109-114` (geen `tooManyTries`/`noteFailedTry`). | `tooManyTries`/`noteFailedTry` op deze route, zoals bij `/api/auth/login`. |
| **C4** | **P2** | `server/routes/auth.js`, `herstel.js`, `account.js` | `RTG_DEV_LINKS=1` lekt herstel-/verify-URL's en SMS-code in de HTTP-respons; niet gedekt door de release-poort. | Bij een gezette dev-vlag in een verkeerde omgeving lekken herstelgeheimen. | `routes/auth.js:65`; `routes/auth/herstel.js:122`. | `RTG_DEV_LINKS` als harde fout in `config/productie-lokaal.js` / openbaar-adres. |
| **C5** | **P2** | `server/kern/payroll/bijwerken.js`, `dekking-bronnen.js` | SSRF: payroll-bronlaag haalt een kantoor-opgegeven URL op zonder intern-adresfilter en volgt redirects (anders dan de voorbeeldige SSO-fetch). | Kantoorhouder kan interne adressen laten aanroepen. | `payroll/bijwerken.js:160-163`; `dekking-bronnen.js:31-34`. | Hergebruik de SSRF-hardening van `server/sso/haal.js` (intern-adres/redirect-filter) + liefst IP-pin tegen DNS-rebinding. |
| **C6** | **P2** | `server/db/merge.js` + `server/db/sqlite.js` | SQLite-productiestand: de kruisproces-merge lost een scalar-conflict stil op ten gunste van de laatste schrijver → verloren saldo-update. | Stille lost-update op geld/stand bij gelijktijdigheid in SQLite-modus. | `merge.js:29` (`return ours; // laatste schrijver`); `sqlite.js:109`. Contrast: `pg/verzoekmerge.js` geeft 409. | **Verbied SQLite als productiestand** (eis PostgreSQL in prod) óf til de 409-conflictdetectie van de PG-merge naar de SQLite-merge. Scope: DISABLE_V1. |

> Opt-in `RTG_EIGEN_HTTP=1`-motoren (`server/lib/http1.js`, `http1-res.js`)
> missen request-smuggling- en CRLF-verdediging (P2, DISABLE_V1). Niet in
> productie geblokkeerd — **houd de standaard `node:http`-motor in productie**.

---

## D. RELIABILITY / DATA BLOCKERS

Geen P0/P1 in deze dimensies. De PostgreSQL-productiestand is sterk: de
requestcommit-gate geeft nooit een valse 200 (`server/db/postgres-verzoeken.js`),
accounts committen atomair mee (`server/accounts/transactie.js` +
`server/db/deelnemers.js`), en de drie-weg requestmerge faalt gesloten op
scalar-conflicten (`server/pg/verzoekmerge.js`). De in `RELEASEKANDIDAAT.md`
gevreesde "`save()` zet alleen een vlag" blijkt in PG-modus gedekt.

| ID | Sev | Systeem | Probleem | Impact | Bewijs | Fix |
|---|---|---|---|---|---|---|
| **D1** | **P2** | `server/server.js` crash-handler | `uncaughtException` flusht minder dan SIGTERM: geen synchrone journaal-/vertaal-/snapshotflush. | Bij een crash verdwijnt een write-behind-venster + gebufferde auditregels — precies waar incidentreconstructie op leunt. | `server.js:143-154` (alleen `save()`); vgl. SIGTERM `opzet/luister.js:135-139`. | Laat de `uncaughtException`-handler dezelfde flush draaien als SIGTERM vóór `exit(1)`. |
| **D2** | **P2** | audit/opslag (`STILSPOOR.json`) | 41 spoor-/opslagschrijvers met gesmoorde fout, 0 met een vastgelegd besluit (LAT.md regel 21-schuld). | Een mislukte audit-/opslagschrijf kan stil verdwijnen. | `STILSPOOR.json` (`spoorGesmoord:17, opslagGesmoord:24, …MetBesluit:0`); `server/db/postgres.js:176`. | Per gesmoorde schrijver een expliciet besluit (bewust of repareren); de kritieke audit-schrijvers fail-closed. |
| **D3** | **P2** | `server/middleware/idempotentie.js` | Generieke idempotentielaag is per-proces (`new Map()`); dekt in een cluster niet. | Dubbele niet-geld-mutaties als een retry op een andere werker landt. (Geld-idempotentie is wél cluster-breed via PG.) | `idempotentie.js:92` + docstring 59-61. | Deel de idempotentiekas via PG/Redis voor muterende routes in clustermodus. |
| **D4** | **P2** | `IDEMPROEF.json` / `MUTATIECONTRACT.json` | Idempotentie/mutatiecontract is voor 1739 van ~5148 routes beproefd (3409 ongemeten); registers stale t.o.v. `b7f14dfa`. | Onbekende herhaalbaarheid op een groot deel van de muterende routes. | `IDEMPROEF.json` (`beoordeeld 1739, ongemeten 3409`), stempel `387b942c5` ≠ HEAD. | Meet door op de kritieke muterende routes; herijk de registers op de release-commit. |
| **D5** | **P2** | geldmotor-cutover | Rust-motoridempotentie is op de meeste geldpaden niet bedraad (callers zonder `economischeSleutel`). | Double-book-risico bij cutover naar de Rust-geldmotor. | `kern/pay/boeking.js:69`; callers `kern/pay/huis.js:30,43`. | Bedraad `economischeSleutel` op alle geldcallers vóór motor-cutover (los van V1 zolang `RTG_MOTOR_GELD` uit staat). |

---

## E. TEST GAPS — onbewezen kritieke stromen

**Positief:** 15.773 tests, waarvan 15.770 groen (de 3 reds: 2× schermeigenaar
governance-drift = B4; 1× `bewijskosten` = shallow-clone/git-history-artefact,
niet-reproduceerbaar in echte CI). AVG-wissing (`vergeten.test.js`,
database-brede bezem), betaalwebhook-faalinjectie
(`betaalwebhook-fouten.test.js`) en ongeverifieerde betaalbevestiging worden
tegen **echte modules** beproefd, niet gemockt. 36 PG-integratietests tegen
echte `postgres:16` in CI.

Onbewezen / ontbrekend:

- **Sessie-/tokentype-scheiding:** geen toets dwong af dat `verifyToken` een
  actietoken weigert (B1 bleef daardoor onzichtbaar). **Toe te voegen.**
- **Cross-member meldingenisolatie:** geen toets dekt de tier-bak-leak (B2); de
  IDOR-proef test alleen object-id-hergebruik, niet gedeelde bakken.
- **Concurrency/race op geld in SQLite-modus:** geen toets dekt de lost-update
  van C6.
- **Deploy-misconfiguratie:** geen toets dat een openbaar adres zonder
  `NODE_ENV=production` weigert te starten (B3).
- **PG- en browser-e2e draaien niet in `npm test`** en per-PR alleen
  incrementeel (`ci.yml`); 22 PG-toetsen worden lokaal overgeslagen zonder
  `DATABASE_URL` (tellen als gezakt voor de release).
- **Provider-failure/timeout op de echte betaalrail** en de Rust-geldmotor onder
  split-brain zijn niet uitvoerbaar getest in deze read-only context.
- `SUITE.json` (laatste-ronde-register) meldt zelf `groen:false`, `mislukt:9`,
  `overgeslagen:43`, stempel `c47e0090` — stale en niet-groen.

---

## F. PRODUCTION / DEPLOYMENT BLOCKERS

| ID | Sev | Systeem | Probleem | Bewijs |
|---|---|---|---|---|
| **F1** | **P1** | `NODE_ENV`-gating | = B3: hardening fail-open buiten `NODE_ENV=production`. | zie B3. |
| **F2** | **P2** | release-gate | Suite rood op release-commit (B4) → `release:gate`/`productie:status` kan niet READY worden. | `productie-oordeel.js` eist groene, skip-vrije suite; `SUITE.json groen:false`. |
| **F3** | **extern** | geldmodel/uitbetaalprovider (RELEASEKANDIDAAT B2/B3, E9) | `uitgaandGeconfigureerd=false` (`config/productie-geld.js:95-102`); `betaal.js` weigert uitbetaling. Besluit "met/zonder geld" + merchant-account ontbreekt. | `config/productie-geld.js`. Besluit van de eigenaar + E9. |
| **F4** | **extern** | host/TLS/DNS/objectopslag/SMTP (E2-E7) | Geen bewezen productiehost, ACME/TLS, S3-bucket, SMTP+SPF/DKIM/DMARC, foutalarm-sink, off-site back-up. | `RELEASEKANDIDAAT.md` §1 E-reeks. |
| **F5** | **extern/legaal** | pentest + DPIA + verwerkersovereenkomsten (E1, E8, B4) | Geen onafhankelijke pentest; DPIA-fundament niet beoordeeld/getekend; verwerkersregister/datalek-papierwerk open. | `DPIA.md`, `VERWERKINGSREGISTER.md`, `DATALEK.md`. |
| **F6** | **besluit** | image-kwetsbaarheidsscan (B6) | Geen scanner in CI; dossier eist `imageVulnerabilityScan`. | `RELEASEKANDIDAAT.md` B6. |

> **Sterk:** de *ondersteunde* productieweg (Docker-image + compose + `golive`)
> is non-root, read-only, `cap_drop ALL`, secrets-as-files, met harde
> exitcodes en cryptografisch verankerde release-handtekeningen
> (`release-trust.js`, `external-release.js`, `productie-oordeel.js`). De
> A1-blokkade uit `RELEASEKANDIDAAT.md` (release-gate gaf afbouwslot niet door)
> is in de code opgelost; het register loopt achter.

---

## G. ARCHITECTURE VIOLATIONS

Geen P0/P1. De kern-grenzen worden in de praktijk gehandhaafd (domeingrens-Proxy
fail-closed; kantoordeur dicht in prod; huisbreed hash-geketend auditspoor met
actor-uit-sessie; envelop leidt actor uit de servergezette sessie). De
afwijkingen zijn bewuste schaduw of register-drift:

| ID | Sev | Systeem | Overtreding | Bewijs |
|---|---|---|---|---|
| **G1** | **P2** | `server/kern/stuur/beleid.js`, `middleware/schorspoort.js` | Proof-aware routing houdt **niets** tegen: 0 bewezen, 0 geschorst. De handhaving rust volledig op de legacy-poorten. Presenteer de "bewijs-gestuurde" beloften (FABRIC/AUTHORITY.md) daarom niet als afgedwongen. | `beleid.js:133`; `schorspoort.js:48`; `VERTROUWEN.json {bewezen:0,geschorst:0}`. |
| **G2** | **P2** | `server/kern/beleidsmotor` | AUTHORITY.md-beleidsmotor is uitsluitend schaduw; dwingt alleen af als `afdwingen.aan(deur)` (nergens true). | `beleidsmotor/index.js:13,93`; `afdwingen.js:26`. |
| **G3** | **P2** | `server/opzet/domeingrens.js` | Data-eigendom niet afgedwongen: elk domein krijgt volledige `db`/`save` via de gedeelde interface; source-of-truth is voor DATA conventioneel. | `domeingrens.js:47-54,101`. |
| **G4** | **P3** | registers | Meetregisters lopen achter op HEAD; `EXECUTION_MAP.json` mist een stempel; `KANTOORMACHT.json anoniemUitvoerbaar:358` is een lexicale overschatting (de routes zijn feitelijk gepoort); `ROUTEBRON.json` incompleet (≥25 bestaande routes ontbreken). | `VERTROUWEN.json 2026-09-29` vs HEAD 2026-10-05; `regering.js:31` (`officeAuth`); FRONTEND-crosscheck. |

> Geen bewezen directe-DB-write die het officiële mutatiepad omzeilt; geen
> privileged route zonder poort in de steekproef; geen metric-als-waarheid
> zonder bewijsgraad in de kritieke paden.

---

## H. WAT AL PRODUCTION-GRADE IS

| Systeem | Bewijs | Waarom releasewaardig |
|---|---|---|
| **Betaalwebhooks** | `betaal/webhook.js:20-44`, `stripe.js:60-75`, `adyen.js:34-46` | Echte HMAC-handtekeningcontrole, timing-safe, replay-tolerantievenster; demo weigert zonder secret. Client kan status niet vervalsen. *(Auditor-geverifieerd.)* |
| **Betaalwaarheid** | `kern/betaalwaarheid/*`, `kern/betaalopdracht/inzending.js` (MONEY-012) | Providerantwoord = bewijs, geen auto-waarheid; dubbele/gedeeltelijke refund, verkeerd bedrag, payout-timeout correct afgehandeld; geen geld uit niets. |
| **Identiteitskluis** | `accounts/kluis.js` | AES-256-GCM + HMAC-zoekhash + HKDF-domeinscheiding + AAD-gebonden KYC; echte naam nooit in operationele data. |
| **PostgreSQL-transacties** | `db/postgres-verzoeken.js`, `accounts/transactie.js`, `pg/verzoekmerge.js` | Geen valse 200; atomische account-commit; 409 i.p.v. stille lost-update; vaste lock-ordening tegen deadlocks. |
| **Websec-grondslag** | `middleware/csp.js`, `opzet/koppen.js`, `web/bestanden.js`, `media/bestand.js`, `lib/rtgjson.js` | Bearer-only (CSRF structureel n.v.t.), CSP met per-verzoek nonce zonder `unsafe-inline` (XSS-impact ~nul), padtraversal/MIME-sniffing/prototype-pollution afgevangen. |
| **Demo-backdoor dicht in prod** | `config/productie-lokaal.js:6-9`, `config.js:64-70` | `RTG_DEMO`/`RTG_MAGNAAT_TEST` zijn harde fouten → `exit(1)`. Geen demo-accounts, pincode-uit-broncode of zelfbevestigende betaalprovider in productie. *(Auditor-geverifieerd.)* |
| **AVG-wissing** | `kern/vergeten.js` (`vergeten.test.js`) | Dekt wees-bytes, mediastore, `member_state`-selfie, write-behind-race; wettelijke retentie-uitzonderingen. |
| **Auditspoor** | `opzet/auditspoor.js`, `db/audit-sqlite.js` | Onwisbaar, hash-geketend, landt vóór de requestcommit, actor uit de sessie (niet het verzoek). |
| **Backup/herstel** | `scripts/docker/herstel.sh`, `live.sh`, `db/duurzaam.js` | Ondertekend + checksum-geverifieerd herstel; geld en gepoortte toestemming via synchrone `fsync`-`saveDuurzaam()`. |
| **Frontend↔backend-contract** | FRONTEND-crosscheck (322 schermen × ~1109 API-calls) | 0 niet-bestaande routes; geen dode knoppen; geen TODO/FIXME/HACK; uniforme server-side autorisatie. |
| **Kantoordeur in prod** | `kern/kantoor/productiedeur.js` | 26 kamers achter één gedeelde code → in prod dicht; toegang op naam met aan de sessie gebonden passkey. |

---

## I. V1-SCOPE

### SHIP IN V1 (werkt, veilig, bewezen — ná B1/B2/B3/B4)
- Ledenportaal + PWA kern: account, login/2FA *(na B1)*, profiel, boardroom.
- Betalingen (inkomend) met echte provider + webhooks *(na besluit F3/E9)*;
  betaalwaarheid, settlement, refunds, cadeaukaart.
- Supplier/zaak-backoffice met zaak-isolatie; kantoor op naam met passkey.
- Data op PostgreSQL (niet SQLite — zie C6); AVG-wissing, inzagejournaal.
- Horeca/mobiliteit/reizen/commerce-kernketens (tafel-, rit-, toelatingsproeven
  groen).

### DISABLE FOR V1 (hard dicht laten tot verder bewijs)
- **SQLite als productie-opslag** (C6) → eis PostgreSQL.
- **Eigen HTTP/HTTP2-motor** (`RTG_EIGEN_HTTP`) → standaard `node:http`.
- **Rust-geldmotor-cutover** (D5) tot `economischeSleutel` overal bedraad.
- **FoundationOS voor minderjarigen** (RELEASEKANDIDAAT B8, default `GESLOTEN`).
- Onvolgroeide "werelden" die 503 geven in dicht-productie: verberg de tegels
  (zie FRONTEND P2) i.p.v. ze te tonen.

### POST-V1 (bewust uitgeschakeld / later)
- DemocratieOS/POLITIEK fase C, HDI-lagen, toekomstige OS-lagen.
- Proof-aware routing / beleidsmotor als afdwingende laag (G1/G2) — eerst
  schaduw volmeten.
- Uitbetalingen aan leden / e-money-rail (vergunningsbesluit, RELEASEKANDIDAAT
  B2a/B3).

---

## J. RELEASE GATE CHECKLIST

Alleen `[x]` waar technisch bewezen in deze audit.

- [ ] **Security** — twee P0 open (B1, B2); C3-C6 open.
- [ ] **Authentication** — B1 (2FA-bypass) blokkeert.
- [x] **Authorization** — rol/tier server-side uit de sessie; ledengate weigert
  andere rollen; tier alleen via menselijk besluit. *(Bewezen; least-privilege
  binnen kantoor is P2.)*
- [x] **Tenant isolation** — zaak/supplier-isolatie uit de sessie; object-IDOR
  consistent afgevangen. *(Bewezen; uitzondering = B2 meldingen.)*
- [ ] **Privacy** — B2 (cross-member PII-lek) blokkeert; fail-open kluissporen
  (P2) open.
- [x] **Critical data integrity (PostgreSQL)** — requestcommit-gate, atomische
  accounts, 409-conflictdetectie. *(Bewezen in PG-modus; SQLite = C6.)*
- [x] **Payments** — webhookverificatie, betaalwaarheid, geen dubbele
  betaling/refund. *(Code-bewezen; echte provider/host = F3/E9.)*
- [x] **Core workflows** — tafel-/rit-/toelatingsketens groen; frontend-contract
  heel.
- [x] **Recovery** — crash-handlers, degradatie, duurzame geld-/consent-writes.
  *(D1 flush-gap = P2.)*
- [ ] **Backups** — keten bewezen in code; off-site/echte host niet
  geverifieerd (E6).
- [x] **Observability** — gestructureerd loggen + correlatie-id, hash-geketend
  auditspoor, health/ready, foutmelder. *(E-sink extern = F4.)*
- [ ] **Deployment** — B3 (`NODE_ENV`-fail-open) + externe host/TLS (F4).
- [ ] **Critical tests** — suite rood op release-commit (B4); PG/e2e niet in
  `npm test`.
- [~] **Performance** — geen blokkerende bevinding; geen loadtest uitgevoerd in
  deze read-only audit (niet bewezen).
- [x] **Error handling** — centrale async-isolatie, 4xx/5xx-afsluiter,
  crash-vangnetten. *(Gesmoorde schrijvers = D2.)*
- [ ] **External integrations** — betaalprovider/SMTP/objectopslag/pentest/DPIA
  open (F3-F6).

---

## K. EXACT AFBOUWPLAN (geordend)

> Volgorde: eerst de twee P0's (security/privacy), dan de deploy-hardening, dan
> de release-gate, dan de risico-verlagers. Elke stap is klein en lokaal.

### RELEASE BLOCKER 1 — 2FA-bypass / actietoken telt als sessie (P0)
- **Bestanden:** `server/accounts/tokens.js` (`verifyToken`, `issueActionToken`,
  `verifyActionToken`); evt. `server/accounts/kluis.js` (`sleutelVoor`).
- **Probleem:** `verifyToken` accepteert elk door de server getekend actietoken
  (`inlog2`, `verify-email`, `mailwissel`, `sso-overdracht`) als volwaardige
  sessie, omdat sessie- en actietokens met dezelfde sleutel worden getekend en
  er geen type-discriminator is; `Number('inlog2') < Date.now()` is `false`.
- **Gewenste architectuur:** sessie- en actietokens zijn
  **cryptografisch niet-uitwisselbaar** — consistent met de bestaande
  HKDF-domeinscheiding (`kluis.sleutelVoor`) die juist hiervoor bestaat.
- **Concrete wijziging:** onderteken actietokens met
  `kluis.sleutelVoor('actie:'+purpose)` i.p.v. de kale `kluis.sign(S.SECRET)`;
  `verifyActionToken` verifieert met dezelfde afgeleide sleutel. Aanvullend in
  `verifyToken`: eis `Number.isFinite(Number(exp))` én een plausibele
  ms-timestamp (`> 1e12`) zodat een niet-numerieke `purpose` nooit door de
  vervalcheck glipt. (Let op terugwaartse geldigheid van bestaande tokens:
  of korte uitfasering, of de numerieke-check als overgang.)
- **Toe te voegen tests:** `verifyToken(issueActionToken(id,'inlog2',…))===null`
  en idem voor `verify-email`/`mailwissel`/`sso-overdracht`; e2e: wachtwoord-only
  login → `bewijs`; `bewijs` als `Bearer` op `/api/auth/me` → 401.
- **Bewijs dat het opgelost is:** de reproductie
  (`scratchpad/repro-2fa.js`) geeft dan `null` voor beide actietokens en nog
  steeds de user voor een echt sessietoken; de nieuwe unit-toetsen groen.

### RELEASE BLOCKER 2 — cross-member meldingenlek (P0, AVG)
- **Bestanden:** `server/opzet/meldingen.js` (`meld`), `server/server.js`
  (`meldingenVan`, `/api/notifications/read`), en de persoonlijke schrijvers:
  `routes/supplier/boekingen.js:36`, `routes/office/werk.js:121`,
  `routes/supplier/gastcontact.js:44`, `routes/office/verificaties.js:99`, plus
  `orders/afhandeling.js`, `kassa/innen.js`, vervoer/verhuur/charter.
- **Probleem:** persoonlijke meldingen gaan via `notify(tier)` naar een per-pas
  gedeelde bak + SSE-broadcast; elk lid leest de meldingen van alle leden met
  dezelfde pas.
- **Gewenste architectuur:** persoonlijke meldingen op de **ledensleutel**
  (`user-<id>`); `notify(tier)` uitsluitend voor echte, niet-persoonlijke
  broadcasts.
- **Concrete wijziging:** vervang in de schrijvers `b.customerTier`→
  `b.customerKey`, `u.tier`→`'user-'+u.id`, `meta.tier`→`lijn.lidKey`, en roep
  `meldLid(key)` aan (`server/opzet/meldaan.js:83`). Laat `meldingenVan` de
  tier-bak alleen nog lezen voor items met een expliciete broadcast-markering.
  Fix `/api/notifications/read` zodat het niet de gedeelde tier-bak voor
  iedereen op gelezen zet.
- **Toe te voegen tests:** twee echte leden, zelfde pas; A maakt een boeking/chat
  → B's `/api/notifications` en B's SSE-stream bevatten die melding **niet**;
  uitbreiding van `scripts/gluurronde.js` met de meldingen-as.
- **Bewijs dat het opgelost is:** de isolatietoets groen; `meld()` schrijft voor
  persoonlijke inhoud aantoonbaar alleen op `user-<id>`.

### RELEASE BLOCKER 3 — productie-hardening deploy-onafhankelijk maken (P1)
- **Bestanden:** `server/config/openbaar.js` (`keurOpenbareBouwstand`),
  `server/config.js`, `server/kern/kantoor/productiedeur.js`,
  `server/opzet/poortwachters.js`, encryptie-/kluissleutel-checks in
  `config/productie*.js`.
- **Probleem:** alle hardening keyt op `NODE_ENV==='production'`; een openbaar
  adres zonder die vlag start wijd open met configfouten als loutere
  waarschuwing.
- **Gewenste architectuur:** "aantoonbaar openbaar" (`installatieSoort`) is net
  zo bindend als `NODE_ENV=production`; fail-closed.
- **Concrete wijziging:** laat `productiedeur`, de kluissleutel-/encryptie-eisen
  en de inlogrem afgaan op `openbaar.installatieSoort(env).soort==='openbaar'`
  **OF** `NODE_ENV==='production'`; promoveer in `keurOpenbareBouwstand` de
  `schaduwFouten` tot `hardeFouten` voor een openbaar adres (zoals demo-op-publiek
  al is).
- **Toe te voegen tests:** `valideer({APP_URL:'https://echt.nl',
  NODE_ENV:undefined, RTG_ENC_KEY:undefined})` → hardeFout/exit; office-login
  dicht; foundation-poort doet geen `next()` bij openbaar adres zonder
  `NODE_ENV`.
- **Bewijs dat het opgelost is:** start met openbaar `APP_URL` zonder
  `NODE_ENV` weigert (exit 1); met `NODE_ENV=production` + sleutels start
  normaal.

### RELEASE BLOCKER 4 — suite groen op de release-commit (P2, gate-blokkerend)
- **Bestanden:** `SCHERMEIGENAAR.json`, evt. `public/site/techniek/techniek.html`.
- **Probleem:** `test/schermeigenaar.test.js` faalt — het techniek-scherm staat
  niet in het eigenaarsregister.
- **Concrete wijziging:** registreer `site/techniek/techniek.html` in
  `SCHERMEIGENAAR.json` met capability + rol (of als alias met oordeel), conform
  de consolidatiedoctrine.
- **Toe te voegen tests:** geen nieuwe; de bestaande
  `test/schermeigenaar.test.js` moet groen worden, en de volledige suite
  (`scripts/test-runner.js`) skip-vrij groen op de release-commit.
- **Bewijs dat het opgelost is:** `node --test test/schermeigenaar.test.js`
  `# fail 0`; `npm test` groen; `SUITE.json groen:true` op de release-commit.

### DAARNA (risico-verlagers, in deze volgorde)
5. **C6** — verbied SQLite als productiestand (eis PostgreSQL) of til de
   409-conflictdetectie naar de SQLite-merge.
6. **C3/C4/C5** — rem op `/api/auth/tweede`; `RTG_DEV_LINKS` harde fout op
   openbaar adres; SSRF-filter op de payroll-bronlaag.
7. **D1/D2** — `uncaughtException` dezelfde flush als SIGTERM; expliciet besluit
   per gesmoorde audit-/opslagschrijver.
8. **FRONTEND P2** — verberg FoundationOS-tegels (`vrienden`, `rtfbord`,
   `rtfschrift`, `klimaat`) wanneer de foundation-poort dicht is, zodat er geen
   zichtbare ingang naar een 503 bestaat.
9. **Registers herijken** op de release-commit (`ROUTEBRON`, `VERTROUWEN`,
   `IDEMPROEF`, `MUTATIECONTRACT`, `EXECUTION_MAP`-stempel, `KANTOORMACHT`).
10. **Externe/legale poorten** (F3-F6): geldmodel + uitbetaalprovider,
    productiehost/TLS/objectopslag/SMTP, onafhankelijke pentest, DPIA +
    verwerkersovereenkomsten, image-kwetsbaarheidsscan.

---

## Verantwoording & grenzen van deze audit

- **Zelf gereproduceerd/geverifieerd:** B1 (live tegen de echte
  `accounts`-module), B2/B3/B4 (code + testrun), webhook- en demo-gating
  (strengths H).
- **Agent-bevindingen, adversarieel nagetrokken:** alle P0/P1 zijn door een
  tweede, onafhankelijke verificatiepas tegen de code gehaald; de privacy-P1
  (BIG-nummer fail-open journaal) is daarbij terecht naar **P2** bijgesteld
  (achter `kluisAuth` op naam + tweede pushpad; bijt alleen onder
  infrastructuurfalen).
- **Niet verifieerbaar hier (read-only, geen echte host):** TLS/ACME/DNS,
  objectopslag, SMTP-bezorging, echte betaalprovider-sandbox, de pgwire-driver
  onder echte concurrency, loadtests, en alle externe/legale items. Deze zijn
  als `extern` gemarkeerd, niet als bewezen.
- **Registers lopen achter op HEAD** — overal waar een register is geciteerd, is
  de code als leidend behandeld.
